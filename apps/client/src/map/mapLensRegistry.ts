import type { HexTile } from "@arcanorum/shared";
import type {
  MapInteractionMode,
  MapLensDescriptor,
  MapLensId,
  MapLensRenderCell,
  MapLensRenderContext,
  MapModeDescriptor,
} from "./mapLensTypes";

export const MAP_MODE_DESCRIPTORS: MapModeDescriptor[] = [
  { id: "overview", labelKey: "map.mode.overview", tooltipKey: "map.mode.overviewTooltip" },
  { id: "colonization", labelKey: "map.mode.colonization", tooltipKey: "map.mode.colonizationTooltip" },
  { id: "construction", labelKey: "map.mode.construction", tooltipKey: "map.mode.constructionTooltip" },
  { id: "army", labelKey: "map.mode.army", tooltipKey: "map.mode.armyTooltip" },
  { id: "market", labelKey: "map.mode.market", tooltipKey: "map.mode.marketTooltip" },
  { id: "inspection", labelKey: "map.mode.inspection", tooltipKey: "map.mode.inspectionTooltip" },
];

export const MAP_LENS_DESCRIPTORS: MapLensDescriptor[] = [
  {
    id: "terrain",
    labelKey: "map.lens.terrain",
    tooltipKey: "map.lens.terrainTooltip",
    legend: [{ labelKey: "map.lens.legend.baseTerrain", color: "#7f8f55", tone: "muted" }],
    terrainSuppression: 0,
    borderMode: "none",
    showInternalHexGrid: false,
    waterTreatment: "none",
  },
  {
    id: "political",
    labelKey: "map.lens.political",
    tooltipKey: "map.lens.politicalTooltip",
    legend: [
      { labelKey: "map.lens.legend.owned", color: "#4f8ea8", tone: "accent" },
      { labelKey: "map.lens.legend.colonizing", color: "#8fc8de", tone: "warn" },
      { labelKey: "map.lens.legend.unowned", color: "#8b8270", tone: "muted" },
    ],
    terrainSuppression: 0.44,
    borderMode: "country",
    showInternalHexGrid: false,
    waterTreatment: "muted",
  },
  {
    id: "regions",
    labelKey: "map.lens.regions",
    tooltipKey: "map.lens.regionsTooltip",
    legend: [{ labelKey: "map.lens.legend.regionColor", color: "#d7c38b", tone: "neutral" }],
    terrainSuppression: 0.36,
    borderMode: "region",
    showInternalHexGrid: false,
    waterTreatment: "muted",
  },
  {
    id: "colonization",
    labelKey: "map.lens.colonization",
    tooltipKey: "map.lens.colonizationTooltip",
    legend: [
      { labelKey: "map.lens.legend.colonizable", color: "#4f9d66", tone: "good" },
      { labelKey: "map.lens.legend.colonizing", color: "#d7c35f", tone: "warn" },
      { labelKey: "map.lens.legend.blocked", color: "#7a6f68", tone: "muted" },
    ],
    terrainSuppression: 0.42,
    borderMode: "region",
    showInternalHexGrid: false,
    waterTreatment: "muted",
  },
  {
    id: "population",
    labelKey: "map.lens.population",
    tooltipKey: "map.lens.populationTooltip",
    legend: [
      { labelKey: "map.lens.legend.low", color: "#5d6f70", tone: "muted" },
      { labelKey: "map.lens.legend.high", color: "#d4a64e", tone: "accent" },
    ],
    terrainSuppression: 0.38,
    borderMode: "region",
    showInternalHexGrid: false,
    waterTreatment: "muted",
  },
  {
    id: "market",
    labelKey: "map.lens.market",
    tooltipKey: "map.lens.marketTooltip",
    legend: [
      { labelKey: "map.lens.legend.marketOwned", color: "#3f8fa6", tone: "accent" },
      { labelKey: "map.lens.legend.marketNeutral", color: "#766f5a", tone: "muted" },
    ],
    terrainSuppression: 0.44,
    borderMode: "country",
    showInternalHexGrid: false,
    waterTreatment: "muted",
  },
  {
    id: "infrastructure",
    labelKey: "map.lens.infrastructure",
    tooltipKey: "map.lens.infrastructureTooltip",
    legend: [
      { labelKey: "map.lens.legend.low", color: "#6d665f", tone: "muted" },
      { labelKey: "map.lens.legend.high", color: "#c1b15f", tone: "good" },
    ],
    terrainSuppression: 0.38,
    borderMode: "region",
    showInternalHexGrid: false,
    waterTreatment: "muted",
  },
  {
    id: "military",
    labelKey: "map.lens.military",
    tooltipKey: "map.lens.militaryTooltip",
    legend: [
      { labelKey: "map.lens.legend.controlled", color: "#547fba", tone: "accent" },
      { labelKey: "map.lens.legend.foreign", color: "#9a5f5a", tone: "bad" },
    ],
    terrainSuppression: 0.46,
    borderMode: "country",
    showInternalHexGrid: false,
    waterTreatment: "muted",
  },
];

export function selectMapLensCells(lens: MapLensId, context: MapLensRenderContext): MapLensRenderCell[] {
  if (lens === "terrain") return [];
  const maxPopulation = lens === "population" ? resolveMaxPopulation(context) : 1;
  return context.map.tiles
    .map((tile) => selectTileCell(lens, tile, context, maxPopulation))
    .map((cell) => cell ? applyAnalyticalBaseStyle(cell) : null)
    .map((cell) => cell ? applyWaterLensTransparency(cell) : null)
    .filter((cell): cell is MapLensRenderCell => Boolean(cell));
}

export function getMapLensDescriptor(lens: MapLensId): MapLensDescriptor {
  return MAP_LENS_DESCRIPTORS.find((descriptor) => descriptor.id === lens) ?? MAP_LENS_DESCRIPTORS[0];
}

function selectTileCell(
  lens: MapLensId,
  tile: HexTile,
  context: MapLensRenderContext,
  maxPopulation: number,
): MapLensRenderCell | null {
  const world = context.worldBase;
  const owner = world?.regionOwner[tile.regionId] ?? world?.hexOwner[tile.id] ?? null;
  const controller = world?.regionController[tile.regionId] ?? owner;
  const ownerColor = owner ? resolveCountryColor(owner, context.countryColorById) : 0x7d7666;
  const controllerColor = controller ? resolveCountryColor(controller, context.countryColorById) : ownerColor;
  const colonyLeader = resolveColonyLeader(
    mergeColonyProgress(
      world?.colonyProgressByRegion[tile.regionId],
      context.pendingColonyProgressByRegion?.[tile.regionId],
    ),
  );
  const colonyLeaderColor = colonyLeader ? resolveCountryColor(colonyLeader, context.countryColorById) : null;
  if (lens === "political") {
    if (!owner && colonyLeader && colonyLeaderColor != null) {
      const colonyColor = lightenColor(colonyLeaderColor, 0.42);
      return {
        tile,
        groupId: `colony:${colonyLeader}:${tile.regionId}`,
        borderGroupId: `colony:${colonyLeader}:${tile.regionId}`,
        color: colonyColor,
        alpha: tile.waterKind ? 0.24 : 0.62,
        surfaceAlpha: tile.waterKind ? 0.14 : 0.24,
        terrainMute: tile.waterKind ? 0.28 : 0.42,
        borderColor: lightenColor(colonyLeaderColor, 0.58),
        borderAlpha: 0.58,
        borderTone: "dotted",
        pattern: "stripe",
      };
    }
    return {
      tile,
      groupId: owner ?? `unowned:${tile.regionId}`,
      borderGroupId: owner ?? `unowned:${tile.regionId}`,
      labelGroupId: owner && !tile.waterKind ? owner : undefined,
      label: owner && !tile.waterKind ? resolveCountryName(owner, context.countryNameById) : undefined,
      color: owner ? ownerColor : 0x77706a,
      alpha: owner ? 0.7 : 0.26,
      surfaceAlpha: tile.waterKind ? 0.16 : 0.28,
      terrainMute: tile.waterKind ? 0.28 : 0.42,
      borderColor: controller && controller !== owner ? controllerColor : 0xe6d7b8,
      borderAlpha: controller && controller !== owner ? 0.78 : 0.62,
      borderTone: "strong",
      pattern: controller && controller !== owner ? "hatch" : "none",
    };
  }
  if (lens === "regions") {
    return {
      tile,
      groupId: tile.regionId,
      borderGroupId: tile.regionId,
      color: colorFromId(tile.regionId),
      alpha: tile.waterKind ? 0.34 : 0.58,
      surfaceAlpha: tile.waterKind ? 0.22 : 0.24,
      terrainMute: tile.waterKind ? 0.28 : 0.36,
      borderColor: 0xe2d1a4,
      borderAlpha: 0.48,
      borderTone: "dotted",
    };
  }
  if (lens === "colonization") {
    const progress = world?.colonyProgressByRegion[tile.regionId];
    const config = world?.regionColonizationByRegion[tile.regionId];
    if (owner) {
      return createCell(tile, {
        groupId: owner,
        borderGroupId: owner,
        color: ownerColor,
        alpha: 0.46,
        terrainMute: 0.38,
        borderColor: 0xefe0ad,
        borderAlpha: 0.36,
      });
    }
    if (config?.disabled || tile.waterKind === "ocean") {
      return createCell(tile, {
        groupId: `blocked:${tile.regionId}`,
        borderGroupId: tile.regionId,
        color: 0x6c665d,
        alpha: 0.46,
        terrainMute: 0.42,
        pattern: "hatch",
      });
    }
    if (progress && Object.keys(progress).length > 0) {
      return createCell(tile, {
        groupId: `colonizing:${tile.regionId}`,
        borderGroupId: tile.regionId,
        color: 0xd8c35b,
        alpha: 0.68,
        terrainMute: 0.42,
        borderColor: 0xf6e38a,
        borderAlpha: 0.62,
        pulse: true,
      });
    }
    return createCell(tile, {
      groupId: `colonizable:${tile.regionId}`,
      borderGroupId: tile.regionId,
      color: 0x4e9b67,
      alpha: tile.waterKind ? 0.2 : 0.6,
      terrainMute: tile.waterKind ? 0.3 : 0.4,
      borderColor: 0xb8e0a2,
      borderAlpha: 0.42,
    });
  }
  if (lens === "population") {
    const total = resolveRegionPopulationTotal(world?.regionPopulationByRegion[tile.regionId]);
    const weight = maxPopulation > 0 ? Math.min(1, total / maxPopulation) : 0;
    return createCell(tile, {
      groupId: tile.regionId,
      borderGroupId: tile.regionId,
      color: interpolateColor(0x536c70, 0xd5a54a, weight),
      alpha: 0.42 + weight * 0.28,
      terrainMute: 0.38,
      borderColor: 0xe2d1a4,
      borderAlpha: 0.36,
      borderTone: "dotted",
    });
  }
  if (lens === "market") {
    return {
      tile,
      groupId: owner ?? `neutral:${tile.regionId}`,
      borderGroupId: owner ?? `neutral:${tile.regionId}`,
      color: owner ? ownerColor : 0x756f5b,
      alpha: owner ? 0.66 : 0.28,
      surfaceAlpha: tile.waterKind ? 0.18 : 0.28,
      terrainMute: tile.waterKind ? 0.3 : 0.44,
      borderColor: 0x82d1de,
      borderAlpha: owner ? 0.64 : 0.28,
      borderTone: "strong",
    };
  }
  if (lens === "infrastructure") {
    const buildings = world?.regionBuildingsByRegion[tile.regionId]?.length ?? 0;
    const queued = world?.regionConstructionQueueByRegion[tile.regionId]?.length ?? 0;
    const weight = Math.min(1, (buildings + queued * 0.6) / 8);
    return createCell(tile, {
      groupId: tile.regionId,
      borderGroupId: tile.regionId,
      color: interpolateColor(0x6d665f, 0xc1b15f, weight),
      alpha: 0.42 + weight * 0.28,
      terrainMute: 0.38,
      borderAlpha: queued > 0 ? 0.54 : 0.32,
      borderColor: 0xf2df8d,
      borderTone: "dotted",
      pattern: queued > 0 ? "stripe" : "none",
    });
  }
  if (lens === "military") {
    if (!controller) {
      return createCell(tile, {
        groupId: `neutral:${tile.regionId}`,
        borderGroupId: `neutral:${tile.regionId}`,
        color: 0x6a6257,
        alpha: 0.24,
        terrainMute: 0.42,
      });
    }
    const own = controller === context.authCountryId;
    return createCell(tile, {
      groupId: controller,
      borderGroupId: controller,
      color: own ? 0x547fba : 0x9a5f5a,
      alpha: own ? 0.68 : 0.62,
      terrainMute: 0.46,
      borderColor: own ? 0xb7d1ff : 0xe5b0a8,
      borderAlpha: 0.68,
      borderTone: "strong",
      pattern: own ? "none" : "hatch",
    });
  }
  return null;
}

function resolveMaxPopulation(context: MapLensRenderContext): number {
  const values = Object.values(context.worldBase?.regionPopulationByRegion ?? {}).map((entry) => resolveRegionPopulationTotal(entry));
  return Math.max(1, ...values);
}

function resolveRegionPopulationTotal(entry: { pops?: Array<{ size?: number }> } | undefined): number {
  return (entry?.pops ?? []).reduce((sum, pop) => sum + Math.max(0, Number(pop.size) || 0), 0);
}

function resolveColonyLeader(progressByCountry: Record<string, number> | undefined): string | null {
  let leader: string | null = null;
  let leaderProgress = 0;
  for (const [countryId, progress] of Object.entries(progressByCountry ?? {})) {
    const value = Math.max(0, Number(progress) || 0);
    if (value > leaderProgress) {
      leader = countryId;
      leaderProgress = value;
    }
  }
  return leader;
}

function mergeColonyProgress(
  appliedProgress: Record<string, number> | undefined,
  pendingProgress: Record<string, number> | undefined,
): Record<string, number> | undefined {
  if (!appliedProgress && !pendingProgress) return undefined;
  const merged: Record<string, number> = { ...(appliedProgress ?? {}) };
  for (const [countryId, value] of Object.entries(pendingProgress ?? {})) {
    merged[countryId] = Math.max(Number(merged[countryId]) || 0, Number(value) || 0);
  }
  return merged;
}

function createCell(tile: HexTile, input: Omit<MapLensRenderCell, "tile" | "surfaceAlpha" | "terrainMute"> & { surfaceAlpha?: number; terrainMute?: number }): MapLensRenderCell {
  return {
    ...input,
    tile,
    surfaceAlpha: input.surfaceAlpha ?? (tile.waterKind ? 0.18 : 0.26),
    terrainMute: input.terrainMute ?? (tile.waterKind ? 0.28 : 0.4),
  };
}

function applyWaterLensTransparency(cell: MapLensRenderCell): MapLensRenderCell {
  if (!cell.tile.waterKind) return cell;
  return {
    ...cell,
    alpha: Math.min(cell.alpha, 0.22),
    surfaceAlpha: Math.max(Math.min(cell.surfaceAlpha, 0.58), 0.52),
    terrainMute: Math.max(Math.min(cell.terrainMute, 0.82), 0.76),
    borderAlpha: cell.borderAlpha == null ? undefined : Math.min(cell.borderAlpha, 0.32),
  };
}

function applyAnalyticalBaseStyle(cell: MapLensRenderCell): MapLensRenderCell {
  if (cell.tile.waterKind) return cell;
  return {
    ...cell,
    surfaceAlpha: Math.max(cell.surfaceAlpha, 0.68),
    terrainMute: Math.max(cell.terrainMute, 0.86),
  };
}

function resolveCountryColor(countryId: string, countryColorById: Record<string, string> | undefined): number {
  return parseHexColor(countryColorById?.[countryId]) ?? colorFromId(countryId);
}

function resolveCountryName(countryId: string, countryNameById: Record<string, string> | undefined): string {
  return countryNameById?.[countryId]?.trim() || countryId;
}

function parseHexColor(input: string | null | undefined): number | null {
  if (!input || !/^#[0-9a-fA-F]{6}$/.test(input)) return null;
  return Number.parseInt(input.slice(1), 16);
}

function lightenColor(color: number, amount: number): number {
  const clamped = Math.max(0, Math.min(1, amount));
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const nextR = Math.round(r + (255 - r) * clamped);
  const nextG = Math.round(g + (255 - g) * clamped);
  const nextB = Math.round(b + (255 - b) * clamped);
  return (nextR << 16) | (nextG << 8) | nextB;
}

function colorFromId(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const hue = (hash >>> 0) % 360;
  return hslToRgbNumber(hue, 42, 52);
}

function hslToRgbNumber(h: number, s: number, l: number): number {
  const saturation = s / 100;
  const lightness = l / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - c / 2;
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] :
    [c, 0, x];
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  return (r << 16) | (g << 8) | b;
}

function interpolateColor(from: number, to: number, weight: number): number {
  const clamped = Math.max(0, Math.min(1, weight));
  const fr = (from >> 16) & 255;
  const fg = (from >> 8) & 255;
  const fb = from & 255;
  const tr = (to >> 16) & 255;
  const tg = (to >> 8) & 255;
  const tb = to & 255;
  const r = Math.round(fr + (tr - fr) * clamped);
  const g = Math.round(fg + (tg - fg) * clamped);
  const b = Math.round(fb + (tb - fb) * clamped);
  return (r << 16) | (g << 8) | b;
}
