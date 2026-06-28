import { readFileSync } from "node:fs";
import { imageSize } from "image-size";
import type {
  Division,
  DivisionTemplate,
  MilitaryFormationQueueItem,
  WorldBase,
  HexId,
} from "@arcanorum/shared";
import { calculateFormationTurns, spendMilitaryFormationCost } from "../mechanics/militaryMechanics";
import {
  assignEquipmentVariantsForRequirements,
  calculateEquipmentCoverage,
} from "../mechanics/equipmentMechanics";
import type { GoodFlow } from "../mechanics/contentFieldNormalizers";
import { registerMilitaryRoutes } from "../routes/militaryRoutes";
import type { RouteAuth } from "../security/routeAuth";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";
import type { GameSettings } from "./gameSettingsTypes";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";
import type { MilitaryUploadMiddleware } from "../routes/militaryRoutes";
import type {
  AirWing,
  EquipmentProductionLine,
  Fleet,
  MilitaryBranch,
  DivisionStats,
  DivisionTemplateBattalion,
  MilitaryTemplateComponent,
} from "@arcanorum/shared";
import type { MilitaryContentEntry } from "../mechanics/militaryMechanics";

type MilitaryRuntimeMasks = {
  divisionTemplatesByCountry: number;
  divisionsById: number;
  resourcesByCountry: number;
  militaryFormationQueueByCountry: number;
  unitEquipmentState: number;
};

type MilitaryRuntimeParams = {
  app: Parameters<typeof registerMilitaryRoutes>[0];
  routeAuth: RouteAuth;
  upload: MilitaryUploadMiddleware;
  masks: MilitaryRuntimeMasks;
  createId: () => string;
  getTurnId: () => number;
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  ensureCountryInWorldBase: (countryId: string) => void;
  getCountryMarketRecord: (countryId: string) => GameSettings["markets"]["marketById"][string];
  normalizeMilitaryTemplateComponents: (
    input: unknown,
    kind: MilitaryBranch,
    fallbackBattalions?: DivisionTemplateBattalion[],
  ) => MilitaryTemplateComponent[];
  componentsToDivisionBattalions: (components: MilitaryTemplateComponent[]) => DivisionTemplateBattalion[];
  getMilitaryContentById: (kind: MilitaryBranch, id: string) => MilitaryContentEntry | null;
  getBattalionContentById: (id: string) => MilitaryContentEntry | null;
  calculateMilitaryStats: (kind: MilitaryBranch, components: MilitaryTemplateComponent[]) => DivisionStats;
  calculateDivisionStats: (battalions: DivisionTemplateBattalion[]) => DivisionStats;
  calculateMilitaryFormationCost: (
    kind: MilitaryBranch,
    components: MilitaryTemplateComponent[],
  ) => { ducats: number; manpower: number; equipmentNeeds: GoodFlow[] };
  calculateDivisionTrainingCost: (
    battalions: DivisionTemplateBattalion[],
  ) => { ducats: number; manpower: number; equipmentNeeds: GoodFlow[] };
  refreshDivisionStatsFromTemplates: () => void;
  cloneWorldBaseSectionSnapshot: (mask: number) => WorldBaseSectionSnapshot;
  savePersistentState: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: WorldBaseSectionSnapshot) => void;
  addResourceLedgerExpense?: (input: ResourceLedgerEntryInput) => void;
  flushResourceLedger?: () => void;
  removeUploadedFile: (file: Express.Multer.File | undefined) => void;
  removeUploadedByUrl: (url: string) => void;
  makeVersionedUploadUrl: (relativePath: string) => string;
};

export function registerMilitaryRuntimeRoutes(params: MilitaryRuntimeParams): void {
  const getArmyBattalionCatalog = () => params.getGameSettings().content.battalions;

  const getCountryDivisionTemplates = (countryId: string): DivisionTemplate[] =>
    params.getWorldBase().divisionTemplatesByCountry[countryId] ?? [];

  const getCountryDivisions = (countryId: string): Division[] =>
    Object.values(params.getWorldBase().divisionsById)
      .filter((division) => division.countryId === countryId)
      .sort((a, b) => a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id));

  const getCountryFleets = (countryId: string): Fleet[] =>
    Object.values(params.getWorldBase().fleetsById)
      .filter((fleet) => fleet.countryId === countryId)
      .sort((a, b) => a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id));

  const getCountryAirWings = (countryId: string): AirWing[] =>
    Object.values(params.getWorldBase().airWingsById)
      .filter((airWing) => airWing.countryId === countryId)
      .sort((a, b) => a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id));

  const getCountryMilitaryQueue = (countryId: string): MilitaryFormationQueueItem[] =>
    [...(params.getWorldBase().militaryFormationQueueByCountry[countryId] ?? [])].sort(
      (a, b) => a.createdTurnId - b.createdTurnId || a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id),
    );

  const getCountryOwnedHexOptions = (countryId: string): Array<{ id: string; name: string; neighbors: string[] }> => {
    const world = params.getWorldBase();
    const ownedHexIds = Object.entries(world.hexOwner)
      .filter(([, ownerCountryId]) => ownerCountryId === countryId)
      .map(([hexId]) => hexId)
      .filter(isHexId)
      .sort((a, b) => a.localeCompare(b, "en"));
    const ownedHexIdSet = new Set(ownedHexIds);
    return ownedHexIds
      .map((hexId) => ({
        id: hexId,
        name: world.hexNameById[hexId] ?? hexId,
        neighbors: getAdjacentHexIds(hexId).filter((neighborHexId) => ownedHexIdSet.has(neighborHexId)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id, "en"));
  };

  const getRegionOptions = (): Array<{ id: string; name: string }> => {
    const world = params.getWorldBase();
    const regionIds = new Set([
      ...Object.keys(world.regionOwner),
      ...Object.keys(world.regionController),
      ...Object.keys(world.regionPopulationByRegion),
      ...Object.keys(world.regionColonizationByRegion),
    ]);
    return [...regionIds]
      .map((regionId) => ({ id: regionId, name: regionId }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id, "en"));
  };

  const buildArmyOverview = (countryId: string) => ({
    battalionCatalog: getArmyBattalionCatalog(),
    templates: getCountryDivisionTemplates(countryId),
    divisions: getCountryDivisions(countryId),
    hexOptions: getCountryOwnedHexOptions(countryId),
  });

  const buildMilitaryOverview = (countryId: string) => {
    const gameSettings = params.getGameSettings();
    const countryDivisions = getCountryDivisions(countryId);
    const variants = Object.values(params.getWorldBase().equipmentVariantsById)
      .filter((variant) => !variant.countryId || variant.countryId === countryId)
      .sort((a, b) => a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id, "en"));
    const stockpile = params.getWorldBase().equipmentStockpileByCountry[countryId] ?? {};
    const templateEquipmentAssignments = Object.fromEntries(
      getCountryDivisionTemplates(countryId).map((template) => {
        const choices = assignEquipmentVariantsForRequirements({
          requirements: template.equipmentRequirements ?? [],
          variants,
          stockpileByVariantId: stockpile,
        });
        return [template.id, { choices, coverage: calculateEquipmentCoverage(choices) }];
      }),
    );
    return {
      battalionCatalog: gameSettings.content.battalions,
      shipTypeCatalog: gameSettings.content.shipTypes,
      aircraftTypeCatalog: gameSettings.content.aircraftTypes,
      templates: getCountryDivisionTemplates(countryId),
      units: countryDivisions,
      divisions: countryDivisions,
      fleets: getCountryFleets(countryId),
      airWings: getCountryAirWings(countryId),
      queue: getCountryMilitaryQueue(countryId),
      hexOptions: getCountryOwnedHexOptions(countryId),
      regionOptions: getRegionOptions(),
      formationSpeed: Math.max(1, Number(gameSettings.military.militaryFormationSpeed || 10)),
      equipmentClasses: gameSettings.content.equipmentClasses,
      equipmentFrames: gameSettings.content.equipmentFrames,
      equipmentModules: gameSettings.content.equipmentModules,
      equipmentVariants: variants,
      equipmentProductionLines: [...(params.getWorldBase().equipmentProductionLinesByCountry[countryId] ?? [])].sort(
        (a, b) => a.createdTurnId - b.createdTurnId || a.id.localeCompare(b.id, "en"),
      ),
      equipmentStockpile: stockpile,
      equipmentSupplySummary: buildEquipmentSupplySummary(countryDivisions),
      templateEquipmentAssignments,
    };
  };

  const calculateFormationTurnsForRuntime = (cost: { manpower: number; equipmentNeeds: GoodFlow[] }): number =>
    calculateFormationTurns({
      cost,
      militaryFormationSpeed: params.getGameSettings().military.militaryFormationSpeed,
    });

  const spendMilitaryFormationCostForRuntime = (
    countryId: string,
    cost: { ducats: number; equipmentNeeds: GoodFlow[] },
  ): { ok: true } | { ok: false; error: string; details?: unknown } => {
    const marketRecord = params.getCountryMarketRecord(countryId);
    marketRecord.warehouseByResourceId ??= {};
    const spend = spendMilitaryFormationCost({
      countryResource: params.getWorldBase().resourcesByCountry[countryId],
      countryId,
      warehouseByResourceId: marketRecord.warehouseByResourceId,
      cost,
      addExpense: params.addResourceLedgerExpense,
    });
    if (spend.ok && cost.ducats > 0 && params.addResourceLedgerExpense) {
      params.flushResourceLedger?.();
    }
    return spend;
  };

  registerMilitaryRoutes(params.app, {
    routeAuth: params.routeAuth,
    upload: params.upload,
    masks: params.masks,
    createId: params.createId,
    getTurnId: params.getTurnId,
    ensureCountryInWorldBase: params.ensureCountryInWorldBase,
    buildArmyOverview,
    buildMilitaryOverview,
    getCountryDivisionTemplates,
    setCountryDivisionTemplates: (countryId, templates) => {
      params.getWorldBase().divisionTemplatesByCountry[countryId] = templates;
    },
    getCountryDivisionsById: () => params.getWorldBase().divisionsById,
    getCountryAirWingsById: () => params.getWorldBase().airWingsById,
    getKnownRegionIds: () => getRegionOptions().map((region) => region.id),
    getCountryMilitaryQueue,
    setCountryMilitaryQueue: (countryId, queue) => {
      params.getWorldBase().militaryFormationQueueByCountry[countryId] = queue;
    },
    getEquipmentClasses: () => params.getGameSettings().content.equipmentClasses,
    getEquipmentFrames: () => params.getGameSettings().content.equipmentFrames,
    getEquipmentModules: () => params.getGameSettings().content.equipmentModules,
    getEquipmentVariantsById: () => params.getWorldBase().equipmentVariantsById,
    getCountryEquipmentStockpile: (countryId) => {
      params.getWorldBase().equipmentStockpileByCountry[countryId] ??= {};
      return params.getWorldBase().equipmentStockpileByCountry[countryId];
    },
    getCountryEquipmentProductionLines: (countryId): EquipmentProductionLine[] =>
      params.getWorldBase().equipmentProductionLinesByCountry[countryId] ?? [],
    setCountryEquipmentProductionLines: (countryId, lines) => {
      params.getWorldBase().equipmentProductionLinesByCountry[countryId] = lines;
    },
    getHexOwner: (hexId) => params.getWorldBase().hexOwner[hexId] ?? null,
    validateFormationDeployment: (countryId, kind, hexId) =>
      validateFormationDeploymentHex({
        worldBase: params.getWorldBase(),
        buildings: params.getGameSettings().content.buildings,
        countryId,
        kind,
        hexId,
      }),
    normalizeMilitaryTemplateComponents: params.normalizeMilitaryTemplateComponents,
    componentsToDivisionBattalions: params.componentsToDivisionBattalions,
    getMilitaryContentById: params.getMilitaryContentById,
    getBattalionContentById: params.getBattalionContentById,
    calculateMilitaryStats: params.calculateMilitaryStats,
    calculateDivisionStats: params.calculateDivisionStats,
    calculateMilitaryFormationCost: params.calculateMilitaryFormationCost,
    calculateDivisionTrainingCost: params.calculateDivisionTrainingCost,
    refreshDivisionStatsFromTemplates: params.refreshDivisionStatsFromTemplates,
    refreshCountryDivisionEquipmentState: (countryId) => {
      params.refreshDivisionStatsFromTemplates();
      const countryDivisions = Object.values(params.getWorldBase().divisionsById).filter((division) => division.countryId === countryId);
      for (const division of countryDivisions) {
        params.getWorldBase().divisionsById[division.id] = division;
      }
    },
    calculateFormationTurns: calculateFormationTurnsForRuntime,
    spendMilitaryFormationCost: spendMilitaryFormationCostForRuntime,
    spendDivisionTrainingCost: spendMilitaryFormationCostForRuntime,
    cloneWorldBaseSectionSnapshot: params.cloneWorldBaseSectionSnapshot,
    savePersistentState: params.savePersistentState,
    broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase) =>
      params.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase as WorldBaseSectionSnapshot),
    removeUploadedFile: params.removeUploadedFile,
    removeUploadedByUrl: params.removeUploadedByUrl,
    makeVersionedUploadUrl: params.makeVersionedUploadUrl,
    validateTemplateIcon: validateTemplateIcon,
  });
}

function validateTemplateIcon(file: Express.Multer.File): "ok" | "IMAGE_MUST_BE_64X64" | "IMAGE_INVALID" {
  try {
    const dimensions = imageSize(readFileSync(file.path));
    if (Number(dimensions.width ?? 0) !== 64 || Number(dimensions.height ?? 0) !== 64) {
      return "IMAGE_MUST_BE_64X64";
    }
    return "ok";
  } catch {
    return "IMAGE_INVALID";
  }
}

export function buildEquipmentSupplySummary(divisions: Division[]): {
  turnId: number | null;
  divisionCount: number;
  receivedByVariantId: Record<string, number>;
  returnedByVariantId: Record<string, number>;
} {
  const turnId =
    divisions.reduce<number | null>((latest, division) => {
      const reportTurnId = division.equipmentSupplyReport?.turnId;
      if (typeof reportTurnId !== "number" || !Number.isFinite(reportTurnId)) return latest;
      return latest === null || reportTurnId > latest ? reportTurnId : latest;
    }, null) ?? null;
  const receivedByVariantId: Record<string, number> = {};
  const returnedByVariantId: Record<string, number> = {};
  let divisionCount = 0;
  for (const division of divisions) {
    const report = division.equipmentSupplyReport;
    if (!report || report.turnId !== turnId) continue;
    const receivedTotal = sumEquipmentMap(report.receivedByVariantId);
    const returnedTotal = sumEquipmentMap(report.returnedByVariantId);
    if (receivedTotal <= 0 && returnedTotal <= 0) continue;
    divisionCount += 1;
    mergeEquipmentMap(receivedByVariantId, report.receivedByVariantId);
    mergeEquipmentMap(returnedByVariantId, report.returnedByVariantId);
  }
  return { turnId, divisionCount, receivedByVariantId, returnedByVariantId };
}

function sumEquipmentMap(input: Record<string, number> | undefined): number {
  return Object.values(input ?? {}).reduce((sum, amount) => sum + Math.max(0, Number(amount) || 0), 0);
}

function mergeEquipmentMap(target: Record<string, number>, input: Record<string, number> | undefined): void {
  for (const [variantId, amount] of Object.entries(input ?? {})) {
    const normalizedAmount = Math.max(0, Number(amount) || 0);
    if (normalizedAmount <= 0) continue;
    target[variantId] = Number(((target[variantId] ?? 0) + normalizedAmount).toFixed(3));
  }
}

function validateFormationDeploymentHex(params: {
  worldBase: WorldBase;
  buildings: GameSettings["content"]["buildings"];
  countryId: string;
  kind: MilitaryBranch;
  hexId: HexId;
}): { ok: true } | { ok: false; error: string } {
  const buildingById = new Map(params.buildings.map((building) => [building.id, building] as const));
  for (const [regionId, instances] of Object.entries(params.worldBase.regionBuildingsByRegion ?? {})) {
    const controller = params.worldBase.regionController[regionId] ?? params.worldBase.regionOwner[regionId] ?? null;
    if (controller !== params.countryId) continue;
    for (const instance of instances ?? []) {
      if (instance.targetHexId !== params.hexId) continue;
      const building = buildingById.get(instance.buildingId);
      if (!building?.deployment) return { ok: false, error: "FORMATION_DEPLOYMENT_BUILDING_REQUIRED" };
      if (!building.deployment.branches.includes(params.kind)) {
        return { ok: false, error: "FORMATION_DEPLOYMENT_BRANCH_UNSUPPORTED" };
      }
      if (building.deployment.requiresActive !== false && instance.isInactive) {
        return { ok: false, error: "FORMATION_DEPLOYMENT_BUILDING_REQUIRED" };
      }
      const capacity = Math.max(0, Math.floor(Number(building.deployment.capacity ?? 0) || 0));
      if (capacity > 0 && countDeploymentOccupancy(params.worldBase, params.countryId, params.kind, params.hexId) >= capacity) {
        return { ok: false, error: "FORMATION_DEPLOYMENT_HEX_INVALID" };
      }
      return { ok: true };
    }
  }
  return { ok: false, error: "FORMATION_DEPLOYMENT_HEX_INVALID" };
}

function countDeploymentOccupancy(
  worldBase: WorldBase,
  countryId: string,
  kind: MilitaryBranch,
  hexId: HexId,
): number {
  const queued = (worldBase.militaryFormationQueueByCountry[countryId] ?? []).filter(
    (item) => item.kind === kind && item.hexId === hexId,
  ).length;
  if (kind === "air") {
    return queued + Object.values(worldBase.airWingsById ?? {}).filter((unit) => unit.countryId === countryId && unit.baseHexId === hexId).length;
  }
  if (kind === "naval") {
    return queued + Object.values(worldBase.fleetsById ?? {}).filter((unit) => unit.countryId === countryId && unit.hexId === hexId).length;
  }
  return queued + Object.values(worldBase.divisionsById ?? {}).filter((unit) => unit.countryId === countryId && unit.hexId === hexId).length;
}

function isHexId(value: string): value is `hex:${number}:${number}` {
  return /^hex:-?\d+:-?\d+$/.test(value);
}

function getAdjacentHexIds(hexId: HexId): HexId[] {
  const match = /^hex:(-?\d+):(-?\d+)$/.exec(hexId);
  if (!match) return [];
  const q = Number(match[1]);
  const r = Number(match[2]);
  const offsets = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ] as const;
  return offsets.map(([dq, dr]) => `hex:${q + dq}:${r + dr}` as HexId);
}
