import { readFileSync } from "node:fs";
import { imageSize } from "image-size";
import type {
  Division,
  DivisionTemplate,
  MilitaryFormationQueueItem,
  WorldBase,
} from "@arcanorum/shared";
import { calculateFormationTurns, spendMilitaryFormationCost } from "../mechanics/militaryMechanics";
import type { GoodFlow } from "../mechanics/contentFieldNormalizers";
import { registerMilitaryRoutes } from "../routes/militaryRoutes";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import type { RouteAuth } from "../security/routeAuth";
import type { WorldBaseSectionSnapshot } from "./worldDeltaDiff";
import type { GameSettings } from "./gameSettingsTypes";
import type { ResourceLedgerEntryInput } from "./resourceLedgerRuntime";
import type { MilitaryUploadMiddleware } from "../routes/militaryRoutes";
import type {
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
  getProvinceIndex: () => Adm1ProvinceIndexEntry[];
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

  const getCountryMilitaryQueue = (countryId: string): MilitaryFormationQueueItem[] =>
    [...(params.getWorldBase().militaryFormationQueueByCountry[countryId] ?? [])].sort(
      (a, b) => a.createdTurnId - b.createdTurnId || a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id),
    );

  const getCountryOwnedProvinceOptions = (countryId: string): Array<{ id: string; name: string; neighbors: string[] }> =>
    params
      .getProvinceIndex()
      .filter((province) => params.getWorldBase().provinceOwner[province.id] === countryId)
      .map((province) => ({
        id: province.id,
        name: params.getWorldBase().provinceNameById[province.id] ?? province.name,
        neighbors: province.neighbors,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const buildArmyOverview = (countryId: string) => ({
    battalionCatalog: getArmyBattalionCatalog(),
    templates: getCountryDivisionTemplates(countryId),
    divisions: getCountryDivisions(countryId),
    provinceOptions: getCountryOwnedProvinceOptions(countryId),
  });

  const buildMilitaryOverview = (countryId: string) => {
    const gameSettings = params.getGameSettings();
    return {
      battalionCatalog: gameSettings.content.battalions,
      shipTypeCatalog: gameSettings.content.shipTypes,
      aircraftTypeCatalog: gameSettings.content.aircraftTypes,
      templates: getCountryDivisionTemplates(countryId),
      units: getCountryDivisions(countryId),
      divisions: getCountryDivisions(countryId),
      queue: getCountryMilitaryQueue(countryId),
      provinceOptions: getCountryOwnedProvinceOptions(countryId),
      formationSpeed: Math.max(1, Number(gameSettings.military.militaryFormationSpeed || 10)),
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
    getCountryMilitaryQueue,
    setCountryMilitaryQueue: (countryId, queue) => {
      params.getWorldBase().militaryFormationQueueByCountry[countryId] = queue;
    },
    getProvinceOwner: (provinceId) => params.getWorldBase().provinceOwner[provinceId] ?? null,
    normalizeMilitaryTemplateComponents: params.normalizeMilitaryTemplateComponents,
    componentsToDivisionBattalions: params.componentsToDivisionBattalions,
    getMilitaryContentById: params.getMilitaryContentById,
    getBattalionContentById: params.getBattalionContentById,
    calculateMilitaryStats: params.calculateMilitaryStats,
    calculateDivisionStats: params.calculateDivisionStats,
    calculateMilitaryFormationCost: params.calculateMilitaryFormationCost,
    calculateDivisionTrainingCost: params.calculateDivisionTrainingCost,
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
