import type {
  Division,
  DivisionEquipmentAssignment,
  DivisionEquipmentSupplyReport,
  DivisionStats,
  DivisionSupplyPriority,
  DivisionTemplate,
  DivisionTemplateBattalion,
  HexId,
  MilitaryBranch,
  MilitaryFormationQueueItem,
  MilitaryTemplateComponent,
  WorldBase,
} from "@arcanorum/shared";
import {
  calculateDivisionStats,
  calculateDivisionTrainingCost,
  calculateMilitaryFormationCost,
  calculateMilitaryStats,
  componentsToDivisionBattalions,
  isMilitaryBranch,
  normalizeDivisionBattalions,
  normalizeMilitaryTemplateComponents,
  refreshCountryDivisionEquipmentState,
  type MilitaryContentEntry,
} from "../mechanics/militaryMechanics";
import { normalizeGoodFlows, type GoodFlow } from "../mechanics/contentFieldNormalizers";
import {
  applyEquipmentCoverageToDivisionStats,
  assignEquipmentVariantsForRequirements,
  calculateEquipmentCoverage,
} from "../mechanics/equipmentMechanics";
import type { DefaultBattalionKind, GameSettings } from "./gameSettingsTypes";

type MilitaryContent = GameSettings["content"];
type CreateId = () => string;

function round3(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}

function normalizeDivisionEquipmentAssignments(input: unknown): DivisionEquipmentAssignment[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw): DivisionEquipmentAssignment | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Partial<DivisionEquipmentAssignment>;
      const requirementId = typeof row.requirementId === "string" && row.requirementId.trim() ? row.requirementId.trim().slice(0, 120) : "";
      if (!requirementId) return null;
      const equipmentVariantId =
        typeof row.equipmentVariantId === "string" && row.equipmentVariantId.trim() ? row.equipmentVariantId.trim().slice(0, 120) : null;
      const requiredCount = round3(Math.max(0, Number(row.requiredCount ?? 0) || 0));
      const assignedCount = round3(Math.max(0, Number(row.assignedCount ?? 0) || 0));
      return {
        requirementId,
        equipmentVariantId,
        score: round3(Number(row.score ?? 0) || 0),
        requiredCount,
        assignedCount,
        coverage: requiredCount > 0 ? round3(Math.min(1, assignedCount / requiredCount)) : 1,
      };
    })
    .filter((row): row is DivisionEquipmentAssignment => Boolean(row))
    .slice(0, 64);
}

function normalizeEquipmentByVariantId(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const next: Record<string, number> = {};
  for (const [variantId, amount] of Object.entries(input as Record<string, unknown>)) {
    const normalizedVariantId = variantId.trim().slice(0, 120);
    if (!normalizedVariantId) continue;
    const normalizedAmount = round3(Math.max(0, Number(amount) || 0));
    if (normalizedAmount > 0) next[normalizedVariantId] = normalizedAmount;
  }
  return next;
}

function normalizeDivisionEquipmentSupplyReport(input: unknown): DivisionEquipmentSupplyReport | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const row = input as Partial<DivisionEquipmentSupplyReport>;
  const turnId = typeof row.turnId === "number" && Number.isFinite(row.turnId) ? Math.max(1, Math.floor(row.turnId)) : null;
  return {
    turnId,
    receivedByVariantId: normalizeEquipmentByVariantId(row.receivedByVariantId),
    returnedByVariantId: normalizeEquipmentByVariantId(row.returnedByVariantId),
  };
}

function normalizeDivisionSupplyPriority(input: unknown): DivisionSupplyPriority {
  return input === "low" || input === "high" || input === "normal" ? input : "normal";
}

function getFallbackBattalionTypeId(content: MilitaryContent, defaultBattalions: Array<{ id: DefaultBattalionKind | string }>): string {
  return content.battalions[0]?.id ?? defaultBattalions[0]?.id ?? "infantry";
}

export function getBattalionContentById(content: MilitaryContent, id: string): MilitaryContentEntry | null {
  return content.battalions.find((entry) => entry.id === id) ?? null;
}

export function getMilitaryContentCatalog(content: MilitaryContent, kind: MilitaryBranch): MilitaryContentEntry[] {
  if (kind === "naval") return content.shipTypes;
  if (kind === "air") return content.aircraftTypes;
  return content.battalions;
}

export function getMilitaryContentById(content: MilitaryContent, kind: MilitaryBranch, id: string): MilitaryContentEntry | null {
  return getMilitaryContentCatalog(content, kind).find((entry) => entry.id === id) ?? null;
}

export function normalizeDivisionBattalionsForRuntime(params: {
  input: unknown;
  content: MilitaryContent;
  defaultBattalions: Array<{ id: DefaultBattalionKind | string }>;
  createId: CreateId;
}): DivisionTemplateBattalion[] {
  return normalizeDivisionBattalions({
    input: params.input,
    battalionCatalog: params.content.battalions,
    fallbackBattalionTypeId: getFallbackBattalionTypeId(params.content, params.defaultBattalions),
    createId: params.createId,
  });
}

export function normalizeMilitaryTemplateComponentsForRuntime(params: {
  input: unknown;
  kind: MilitaryBranch;
  content: MilitaryContent;
  fallbackBattalions?: DivisionTemplateBattalion[];
  createId: CreateId;
}): MilitaryTemplateComponent[] {
  return normalizeMilitaryTemplateComponents({
    input: params.input,
    kind: params.kind,
    catalog: getMilitaryContentCatalog(params.content, params.kind),
    fallbackBattalions: params.fallbackBattalions,
    createId: params.createId,
  });
}

export function componentsToDivisionBattalionsForRuntime(
  content: MilitaryContent,
  components: MilitaryTemplateComponent[],
): DivisionTemplateBattalion[] {
  return componentsToDivisionBattalions(components, content.battalions);
}

export function calculateDivisionStatsForRuntime(content: MilitaryContent, battalions: DivisionTemplateBattalion[]): DivisionStats {
  return calculateDivisionStats(battalions, content.battalions);
}

export function calculateMilitaryStatsForRuntime(params: {
  content: MilitaryContent;
  kind: MilitaryBranch;
  components: MilitaryTemplateComponent[];
}): DivisionStats {
  return calculateMilitaryStats({
    kind: params.kind,
    components: params.components,
    catalog: getMilitaryContentCatalog(params.content, params.kind),
    battalionCatalog: params.content.battalions,
  });
}

export function calculateDivisionTrainingCostForRuntime(
  content: MilitaryContent,
  battalions: DivisionTemplateBattalion[],
): {
  ducats: number;
  manpower: number;
  equipmentNeeds: GoodFlow[];
} {
  return calculateDivisionTrainingCost(battalions, content.battalions);
}

export function calculateMilitaryFormationCostForRuntime(params: {
  content: MilitaryContent;
  kind: MilitaryBranch;
  components: MilitaryTemplateComponent[];
}): {
  ducats: number;
  manpower: number;
  equipmentNeeds: GoodFlow[];
} {
  return calculateMilitaryFormationCost({
    kind: params.kind,
    components: params.components,
    catalog: getMilitaryContentCatalog(params.content, params.kind),
    battalionCatalog: params.content.battalions,
  });
}

export function refreshDivisionStatsFromTemplatesForRuntime(params: {
  worldBase: WorldBase;
  content: MilitaryContent;
  defaultBattalions: Array<{ id: DefaultBattalionKind | string }>;
  createId: CreateId;
  turnId?: number | null;
}): void {
  for (const [countryId, templates] of Object.entries(params.worldBase.divisionTemplatesByCountry)) {
    params.worldBase.divisionTemplatesByCountry[countryId] = templates.map((template) => {
      const kind = isMilitaryBranch(template.kind) ? template.kind : "land";
      const battalions = normalizeDivisionBattalionsForRuntime({
        input: template.battalions,
        content: params.content,
        defaultBattalions: params.defaultBattalions,
        createId: params.createId,
      });
      const components = normalizeMilitaryTemplateComponentsForRuntime({
        input: template.components,
        kind,
        content: params.content,
        fallbackBattalions: battalions,
        createId: params.createId,
      });
      const nextBattalions = kind === "land" ? componentsToDivisionBattalionsForRuntime(params.content, components) : [];
      return {
        ...template,
        kind,
        battalions: nextBattalions,
        components,
        stats: calculateMilitaryStatsForRuntime({ content: params.content, kind, components }),
      };
    });
  }
  for (const countryId of Object.keys(params.worldBase.divisionTemplatesByCountry)) {
    refreshCountryDivisionEquipmentState({ countryId, worldBase: params.worldBase, turnId: params.turnId ?? null });
  }
}

function calculateTemplateEquipmentCoverage(worldBase: WorldBase, template: DivisionTemplate): number {
  const requirements = template.equipmentRequirements ?? [];
  if (requirements.length === 0) return 1;
  const stockpile = worldBase.equipmentStockpileByCountry[template.countryId] ?? {};
  const variants = Object.values(worldBase.equipmentVariantsById).filter(
    (variant) => variant.countryId == null || variant.countryId === template.countryId,
  );
  const choices = assignEquipmentVariantsForRequirements({
    requirements,
    variants,
    stockpileByVariantId: stockpile,
  });
  return calculateEquipmentCoverage(choices);
}

export function normalizeDivisionTemplateForRuntime(params: {
  raw: unknown;
  fallbackCountryId?: string;
  content: MilitaryContent;
  defaultBattalions: Array<{ id: DefaultBattalionKind | string }>;
  createId: CreateId;
  turnId: number;
}): DivisionTemplate | null {
  if (!params.raw || typeof params.raw !== "object") return null;
  const row = params.raw as Partial<DivisionTemplate>;
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 120) : params.createId();
  const countryId = typeof row.countryId === "string" && row.countryId.trim()
    ? row.countryId.trim().slice(0, 120)
    : params.fallbackCountryId ?? "";
  if (!countryId) return null;
  const name = typeof row.name === "string" && row.name.trim() ? row.name.trim().slice(0, 80) : "Новая дивизия";
  const kind = isMilitaryBranch(row.kind) ? row.kind : "land";
  const iconUrl = typeof row.iconUrl === "string" || row.iconUrl === null ? (row.iconUrl ?? null) : null;
  const battalions = normalizeDivisionBattalionsForRuntime({
    input: row.battalions,
    content: params.content,
    defaultBattalions: params.defaultBattalions,
    createId: params.createId,
  });
  const components = normalizeMilitaryTemplateComponentsForRuntime({
    input: row.components,
    kind,
    content: params.content,
    fallbackBattalions: battalions,
    createId: params.createId,
  });
  const nextBattalions = kind === "land" ? componentsToDivisionBattalionsForRuntime(params.content, components) : [];
  return {
    id,
    countryId,
    name,
    kind,
    iconUrl,
    battalions: nextBattalions,
    components,
    stats: calculateMilitaryStatsForRuntime({ content: params.content, kind, components }),
    createdTurnId: Math.max(1, Math.floor(Number(row.createdTurnId ?? params.turnId) || params.turnId)),
    updatedTurnId: Math.max(1, Math.floor(Number(row.updatedTurnId ?? params.turnId) || params.turnId)),
  };
}

export function normalizeDivisionTemplatesByCountryForRuntime(params: {
  input: unknown;
  content: MilitaryContent;
  defaultBattalions: Array<{ id: DefaultBattalionKind | string }>;
  createId: CreateId;
  turnId: number;
}): WorldBase["divisionTemplatesByCountry"] {
  if (!params.input || typeof params.input !== "object" || Array.isArray(params.input)) return {};
  const next: WorldBase["divisionTemplatesByCountry"] = {};
  for (const [countryId, rawList] of Object.entries(params.input as Record<string, unknown>)) {
    if (!Array.isArray(rawList)) continue;
    const templates = rawList
      .map((row) => normalizeDivisionTemplateForRuntime({ ...params, raw: row, fallbackCountryId: countryId }))
      .filter((row): row is DivisionTemplate => Boolean(row));
    if (templates.length > 0) next[countryId] = templates;
  }
  return next;
}

export function normalizeDivisionForRuntime(params: {
  raw: unknown;
  worldBase: WorldBase;
  createId: CreateId;
  turnId: number;
}): Division | null {
  if (!params.raw || typeof params.raw !== "object") return null;
  const row = params.raw as Partial<Division>;
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 120) : params.createId();
  const countryId = typeof row.countryId === "string" && row.countryId.trim() ? row.countryId.trim().slice(0, 120) : "";
  const templateId = typeof row.templateId === "string" && row.templateId.trim() ? row.templateId.trim().slice(0, 120) : "";
  const rawHexId = typeof row.hexId === "string" && row.hexId.trim() ? row.hexId.trim().slice(0, 120) : "";
  const hexId = /^hex:-?\d+:-?\d+$/.test(rawHexId) ? (rawHexId as HexId) : null;
  if (!countryId || !templateId || !hexId) return null;
  const template = (params.worldBase.divisionTemplatesByCountry?.[countryId] ?? []).find((entry) => entry.id === templateId);
  const baseStats = template?.stats ?? {
    manpower: Math.max(0, Math.floor(Number(row.stats?.manpower ?? 1000) || 1000)),
    attack: round3(Number(row.stats?.attack ?? 6) || 6),
    defense: round3(Number(row.stats?.defense ?? 10) || 10),
    breakthrough: round3(Number(row.stats?.breakthrough ?? 3) || 3),
    organization: round3(Math.max(1, Number(row.stats?.organization ?? 8) || 8)),
    hp: round3(Math.max(1, Number(row.stats?.hp ?? 25) || 25)),
    speed: round3(Math.max(0.1, Number(row.stats?.speed ?? 1) || 1)),
    supplyUse: round3(Math.max(0, Number(row.stats?.supplyUse ?? 1) || 1)),
  };
  const equipmentCoverage = template ? calculateTemplateEquipmentCoverage(params.worldBase, template) : round3(Math.max(0, Math.min(1, Number(row.equipmentCoverage ?? 1) || 1)));
  const stats = applyEquipmentCoverageToDivisionStats(baseStats, equipmentCoverage);
  const status = row.status === "moving" || row.status === "fighting" || row.status === "retreating" ? row.status : "idle";
  return {
    id,
    countryId,
    templateId,
    name: typeof row.name === "string" && row.name.trim() ? row.name.trim().slice(0, 80) : template?.name ?? "Дивизия",
    kind: isMilitaryBranch(row.kind) ? row.kind : template?.kind ?? "land",
    hexId,
    strength: round3(Math.max(0, Math.min(1, Number(row.strength ?? 1) || 1))),
    organization: round3(Math.max(0, Math.min(stats.organization, Number(row.organization ?? stats.organization) || stats.organization))),
    stats,
    equipmentCoverage,
    equipmentAssignments: normalizeDivisionEquipmentAssignments(row.equipmentAssignments),
    equipmentByVariantId: normalizeEquipmentByVariantId(row.equipmentByVariantId),
    equipmentSupplyReport: normalizeDivisionEquipmentSupplyReport(row.equipmentSupplyReport),
    supplyPriority: normalizeDivisionSupplyPriority(row.supplyPriority),
    status,
    path: Array.isArray(row.path)
      ? row.path.filter((value): value is HexId => typeof value === "string" && /^hex:-?\d+:-?\d+$/.test(value)).slice(0, 64)
      : [],
    createdTurnId: Math.max(1, Math.floor(Number(row.createdTurnId ?? params.turnId) || params.turnId)),
    lastMovedTurnId:
      typeof row.lastMovedTurnId === "number" && Number.isFinite(row.lastMovedTurnId)
        ? Math.max(1, Math.floor(row.lastMovedTurnId))
        : null,
  };
}

export function normalizeDivisionsByIdForRuntime(params: {
  input: unknown;
  worldBase: WorldBase;
  createId: CreateId;
  turnId: number;
}): WorldBase["divisionsById"] {
  if (!params.input || typeof params.input !== "object" || Array.isArray(params.input)) return {};
  const next: WorldBase["divisionsById"] = {};
  for (const raw of Object.values(params.input as Record<string, unknown>)) {
    const division = normalizeDivisionForRuntime({ ...params, raw });
    if (division) next[division.id] = division;
  }
  return next;
}

export function normalizeMilitaryFormationQueueByCountryForRuntime(params: {
  input: unknown;
  createId: CreateId;
  turnId: number;
}): WorldBase["militaryFormationQueueByCountry"] {
  if (!params.input || typeof params.input !== "object" || Array.isArray(params.input)) return {};
  const next: WorldBase["militaryFormationQueueByCountry"] = {};
  for (const [countryId, rawList] of Object.entries(params.input as Record<string, unknown>)) {
    if (!Array.isArray(rawList)) continue;
    const rows = rawList
      .map((raw): MilitaryFormationQueueItem | null => {
        if (!raw || typeof raw !== "object") return null;
        const row = raw as Partial<MilitaryFormationQueueItem>;
        const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 120) : params.createId();
        const kind = isMilitaryBranch(row.kind) ? row.kind : "land";
        const templateId = typeof row.templateId === "string" && row.templateId.trim() ? row.templateId.trim().slice(0, 120) : "";
        const rawHexId = typeof row.hexId === "string" && row.hexId.trim() ? row.hexId.trim().slice(0, 120) : "";
        const hexId = /^hex:-?\d+:-?\d+$/.test(rawHexId) ? (rawHexId as HexId) : null;
        if (!templateId || !hexId) return null;
        const costRaw = row.cost && typeof row.cost === "object" ? row.cost : {};
        const turnsTotal = Math.max(1, Math.floor(Number(row.turnsTotal) || 1));
        const turnsRemaining = Math.max(0, Math.min(turnsTotal, Math.floor(Number(row.turnsRemaining) || turnsTotal)));
        const quantity = Math.max(1, Math.floor(Number(row.quantity) || 1));
        const remainingQuantity = Math.max(
          1,
          Math.min(quantity, Math.floor(Number(row.remainingQuantity ?? quantity) || quantity)),
        );
        const priority = row.priority === "high" || row.priority === "low" ? row.priority : "normal";
        return {
          id,
          countryId,
          kind,
          templateId,
          name: typeof row.name === "string" && row.name.trim() ? row.name.trim().slice(0, 80) : "Формирование",
          hexId,
          quantity,
          remainingQuantity,
          priority,
          repeat: row.repeat === true,
          stalledReasonCode: typeof row.stalledReasonCode === "string" && row.stalledReasonCode.trim()
            ? row.stalledReasonCode.trim().slice(0, 120)
            : null,
          progress: round3(Math.max(0, Math.min(1, Number(row.progress ?? (turnsTotal - turnsRemaining) / turnsTotal) || 0))),
          turnsTotal,
          turnsRemaining,
          cost: {
            ducats: round3(Math.max(0, Number((costRaw as { ducats?: unknown }).ducats) || 0)),
            manpower: round3(Math.max(0, Number((costRaw as { manpower?: unknown }).manpower) || 0)),
            equipmentNeeds: normalizeGoodFlows((costRaw as { equipmentNeeds?: unknown }).equipmentNeeds),
          },
          createdTurnId: Math.max(1, Math.floor(Number(row.createdTurnId ?? params.turnId) || params.turnId)),
        };
      })
      .filter((row): row is MilitaryFormationQueueItem => Boolean(row));
    if (rows.length > 0) next[countryId] = rows;
  }
  return next;
}
