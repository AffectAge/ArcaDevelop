import type express from "express";
import type {
  AirWing,
  Division,
  DivisionStats,
  EquipmentClass,
  EquipmentClassRole,
  EquipmentFrame,
  EquipmentModule,
  EquipmentProductionLine,
  EquipmentVariant,
  HexId,
  DivisionTemplate,
  DivisionTemplateBattalion,
  MilitaryBranch,
  MilitaryFormationQueueItem,
  MilitaryTemplateComponent,
  MilitaryEquipmentRequirement,
} from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";
import { deriveEquipmentVariant } from "../mechanics/equipmentMechanics";

export type MilitaryGoodFlow = {
  goodId: string;
  amount: number;
};

export type MilitaryFormationCost = {
  ducats: number;
  manpower: number;
  equipmentNeeds: MilitaryGoodFlow[];
};

export type MilitaryContentLookupEntry = {
  id: string;
};

export type MilitaryUploadMiddleware = {
  single: (fieldName: string) => express.RequestHandler;
};

export type MilitaryRouteMasks = {
  divisionTemplatesByCountry: number;
  divisionsById: number;
  resourcesByCountry: number;
  militaryFormationQueueByCountry: number;
  unitEquipmentState: number;
};

export type MilitaryRoutesDependencies = {
  routeAuth: RouteAuth;
  upload: MilitaryUploadMiddleware;
  masks: MilitaryRouteMasks;
  createId: () => string;
  getTurnId: () => number;
  ensureCountryInWorldBase: (countryId: string) => void;
  buildArmyOverview: (countryId: string) => unknown;
  buildMilitaryOverview: (countryId: string) => unknown;
  getCountryDivisionTemplates: (countryId: string) => DivisionTemplate[];
  setCountryDivisionTemplates: (countryId: string, templates: DivisionTemplate[]) => void;
  getCountryDivisionsById: () => Record<string, Division>;
  getCountryAirWingsById: () => Record<string, AirWing>;
  getKnownRegionIds: () => string[];
  getCountryMilitaryQueue: (countryId: string) => MilitaryFormationQueueItem[];
  setCountryMilitaryQueue: (countryId: string, queue: MilitaryFormationQueueItem[]) => void;
  getEquipmentClasses: () => EquipmentClass[];
  getEquipmentFrames: () => EquipmentFrame[];
  getEquipmentModules: () => EquipmentModule[];
  getEquipmentVariantsById: () => Record<string, EquipmentVariant>;
  getCountryEquipmentStockpile: (countryId: string) => Record<string, number>;
  getCountryEquipmentProductionLines: (countryId: string) => EquipmentProductionLine[];
  setCountryEquipmentProductionLines: (countryId: string, lines: EquipmentProductionLine[]) => void;
  getHexOwner: (hexId: string) => string | null;
  validateFormationDeployment: (
    countryId: string,
    kind: MilitaryBranch,
    hexId: HexId,
  ) => { ok: true } | { ok: false; error: string };
  normalizeMilitaryTemplateComponents: (
    input: unknown,
    kind: MilitaryBranch,
    fallbackBattalions?: DivisionTemplateBattalion[],
  ) => MilitaryTemplateComponent[];
  componentsToDivisionBattalions: (components: MilitaryTemplateComponent[]) => DivisionTemplateBattalion[];
  getMilitaryContentById: (kind: MilitaryBranch, id: string) => MilitaryContentLookupEntry | null;
  getBattalionContentById: (id: string) => MilitaryContentLookupEntry | null;
  calculateMilitaryStats: (kind: MilitaryBranch, components: MilitaryTemplateComponent[]) => DivisionStats;
  calculateDivisionStats: (battalions: DivisionTemplateBattalion[]) => DivisionStats;
  calculateMilitaryFormationCost: (
    kind: MilitaryBranch,
    components: MilitaryTemplateComponent[],
  ) => MilitaryFormationCost;
  calculateDivisionTrainingCost: (battalions: DivisionTemplateBattalion[]) => MilitaryFormationCost;
  refreshDivisionStatsFromTemplates: () => void;
  refreshCountryDivisionEquipmentState: (countryId: string) => void;
  calculateFormationTurns: (cost: MilitaryFormationCost) => number;
  spendMilitaryFormationCost: (
    countryId: string,
    cost: Pick<MilitaryFormationCost, "ducats" | "equipmentNeeds">,
  ) => { ok: true } | { ok: false; error: string; details?: unknown };
  spendDivisionTrainingCost: (
    countryId: string,
    cost: Pick<MilitaryFormationCost, "ducats" | "equipmentNeeds">,
  ) => { ok: true } | { ok: false; error: string; details?: unknown };
  cloneWorldBaseSectionSnapshot: (mask: number) => unknown;
  savePersistentState: () => void;
  broadcastWorldDeltaFromSectionSnapshot: (previousWorldBase: unknown) => void;
  removeUploadedFile: (file: Express.Multer.File | undefined) => void;
  removeUploadedByUrl: (url: string) => void;
  makeVersionedUploadUrl: (relativePath: string) => string;
  validateTemplateIcon: (file: Express.Multer.File) => "ok" | "IMAGE_MUST_BE_64X64" | "IMAGE_INVALID";
};

const divisionBattalionInputSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  battalionTypeId: z.string().trim().min(1).max(120),
  count: z.coerce.number().int().min(1).max(24),
});

const divisionTemplateInputSchema = z.object({
  templateId: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(80),
  iconUrl: z.string().trim().max(500).nullable().optional(),
  battalions: z.array(divisionBattalionInputSchema).min(1).max(12),
});

const createDivisionInputSchema = z.object({
  templateId: z.string().trim().min(1).max(120),
  hexId: z.string().trim().regex(/^hex:-?\d+:-?\d+$/).max(120),
  name: z.string().trim().min(1).max(80).optional(),
});

const militaryBranchSchema = z.enum(["land", "naval", "air"]);

const militaryTemplateComponentInputSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  typeId: z.string().trim().min(1).max(120),
  count: z.coerce.number().int().min(1).max(999),
  role: z.enum(["line", "support"]).optional(),
});

const equipmentClassRoleSchema = z.enum(["attack", "defense", "breakthrough", "speed", "range", "support"]);

const militaryEquipmentRequirementInputSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  equipmentClassId: z.string().trim().min(1).max(160),
  role: equipmentClassRoleSchema,
  count: z.coerce.number().int().min(1).max(1_000_000),
});

const militaryTemplateInputSchema = z.object({
  templateId: z.string().trim().min(1).max(120).optional(),
  kind: militaryBranchSchema,
  name: z.string().trim().min(1).max(80),
  iconUrl: z.string().trim().max(500).nullable().optional(),
  battalions: z.array(divisionBattalionInputSchema).max(12).optional(),
  components: z.array(militaryTemplateComponentInputSchema).min(1).max(24),
  equipmentRequirements: z.array(militaryEquipmentRequirementInputSchema).max(24).optional(),
});

const createMilitaryFormationInputSchema = z.object({
  templateId: z.string().trim().min(1).max(120),
  hexId: z.string().trim().regex(/^hex:-?\d+:-?\d+$/).max(120),
  name: z.string().trim().min(1).max(80).optional(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  priority: z.enum(["high", "normal", "low"]).default("normal"),
  repeat: z.coerce.boolean().default(false),
});

const createEquipmentVariantInputSchema = z.object({
  frameId: z.string().trim().min(1).max(180).optional(),
  classId: z.string().trim().min(1).max(160).optional(),
  name: z.string().trim().min(1).max(120),
  moduleIdsBySlotId: z.record(z.string().trim().min(1).max(80), z.string().trim().min(1).max(160)).default({}),
});

const createEquipmentProductionLineInputSchema = z.object({
  equipmentVariantId: z.string().trim().min(1).max(180),
  assignedCapacity: z.coerce.number().min(0).max(1_000),
  active: z.boolean().optional(),
});

const updateEquipmentProductionLineInputSchema = z.object({
  assignedCapacity: z.coerce.number().min(0).max(1_000).optional(),
  active: z.boolean().optional(),
});

const divisionSupplyPriorityInputSchema = z.object({
  supplyPriority: z.enum(["low", "normal", "high"]),
});

const airWingMissionInputSchema = z.object({
  mission: z.enum(["none", "air_superiority", "ground_support", "interception", "naval_patrol"]),
  targetRegionId: z.string().trim().min(1).max(160).nullable().optional(),
});

export function registerMilitaryRoutes(app: express.Express, deps: MilitaryRoutesDependencies): void {
  const disbandDivision = (divisionId: string, countryId: string): boolean => {
    const divisions = deps.getCountryDivisionsById();
    const division = divisions[divisionId];
    if (!division || division.countryId !== countryId) return false;
    const stockpile = deps.getCountryEquipmentStockpile(countryId);
    for (const [variantId, amount] of Object.entries(division.equipmentByVariantId ?? {})) {
      const normalizedAmount = Math.max(0, Number(amount) || 0);
      if (normalizedAmount <= 0) continue;
      stockpile[variantId] = Number(((stockpile[variantId] ?? 0) + normalizedAmount).toFixed(3));
    }
    delete divisions[divisionId];
    return true;
  };

  const setDivisionSupplyPriority = (divisionId: string, countryId: string, supplyPriority: Division["supplyPriority"]): boolean => {
    const division = deps.getCountryDivisionsById()[divisionId];
    if (!division || division.countryId !== countryId) return false;
    division.supplyPriority = supplyPriority ?? "normal";
    deps.refreshCountryDivisionEquipmentState(countryId);
    return true;
  };

  const setAirWingMission = (
    airWingId: string,
    countryId: string,
    mission: NonNullable<AirWing["mission"]>,
    targetRegionId: string | null,
  ): boolean => {
    const airWing = deps.getCountryAirWingsById()[airWingId];
    if (!airWing || airWing.countryId !== countryId) return false;
    airWing.mission = mission;
    airWing.status = mission === "none" ? "idle" : "mission";
    airWing.targetRegionId = mission === "none" ? null : targetRegionId;
    return true;
  };

  app.get("/army/overview", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    deps.ensureCountryInWorldBase(auth.countryId);
    return res.json(deps.buildArmyOverview(auth.countryId));
  });

  app.get("/military/overview", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    deps.ensureCountryInWorldBase(auth.countryId);
    return res.json(deps.buildMilitaryOverview(auth.countryId));
  });

  app.post("/military/templates", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = militaryTemplateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    deps.ensureCountryInWorldBase(auth.countryId);
    const kind = parsed.data.kind;
    const components = deps.normalizeMilitaryTemplateComponents(parsed.data.components, kind);
    if (components.length === 0) {
      return res.status(400).json({ error: "EMPTY_TEMPLATE" });
    }
    if (components.some((component) => !deps.getMilitaryContentById(kind, component.typeId))) {
      return res.status(400).json({ error: "UNKNOWN_MILITARY_TYPE" });
    }
    const equipmentClassesById = new Map(deps.getEquipmentClasses().map((entry) => [entry.id, entry]));
    const equipmentRequirements: MilitaryEquipmentRequirement[] = (parsed.data.equipmentRequirements ?? []).map((requirement) => ({
      id: requirement.id ?? `${requirement.equipmentClassId}:${requirement.role}`,
      equipmentClassId: requirement.equipmentClassId,
      role: requirement.role as EquipmentClassRole,
      count: requirement.count,
    }));
    for (const requirement of equipmentRequirements) {
      const equipmentClass = equipmentClassesById.get(requirement.equipmentClassId);
      if (!equipmentClass) {
        return res.status(400).json({ error: "UNKNOWN_EQUIPMENT_CLASS", equipmentClassId: requirement.equipmentClassId });
      }
      if (equipmentClass.branch !== kind) {
        return res.status(400).json({ error: "EQUIPMENT_CLASS_BRANCH_MISMATCH", equipmentClassId: requirement.equipmentClassId });
      }
      if (!equipmentClass.roles.includes(requirement.role)) {
        return res.status(400).json({ error: "EQUIPMENT_ROLE_NOT_SUPPORTED", equipmentClassId: requirement.equipmentClassId, role: requirement.role });
      }
    }
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.divisionTemplatesByCountry | deps.masks.divisionsById,
    );
    const existing = [...deps.getCountryDivisionTemplates(auth.countryId)];
    const templateId = parsed.data.templateId ?? deps.createId();
    const previousTemplate = existing.find((entry) => entry.id === templateId);
    const battalions = kind === "land" ? deps.componentsToDivisionBattalions(components) : [];
    const template: DivisionTemplate = {
      id: templateId,
      countryId: auth.countryId,
      name: parsed.data.name,
      kind,
      iconUrl: parsed.data.iconUrl ?? previousTemplate?.iconUrl ?? null,
      battalions,
      components,
      equipmentRequirements,
      stats: deps.calculateMilitaryStats(kind, components),
      createdTurnId: previousTemplate?.createdTurnId ?? deps.getTurnId(),
      updatedTurnId: deps.getTurnId(),
    };
    deps.setCountryDivisionTemplates(
      auth.countryId,
      existing.some((entry) => entry.id === templateId)
        ? existing.map((entry) => (entry.id === templateId ? template : entry))
        : [...existing, template],
    );

    deps.refreshDivisionStatsFromTemplates();

    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildMilitaryOverview(auth.countryId));
  });

  app.delete("/military/templates/:templateId", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const templateId = String(req.params.templateId ?? "").trim();
    const hasUnit = Object.values(deps.getCountryDivisionsById()).some(
      (unit) => unit.countryId === auth.countryId && unit.templateId === templateId,
    );
    const hasQueue = deps.getCountryMilitaryQueue(auth.countryId).some((item) => item.templateId === templateId);
    if (hasUnit || hasQueue) {
      return res.status(409).json({ error: "TEMPLATE_IN_USE" });
    }
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.divisionTemplatesByCountry);
    deps.setCountryDivisionTemplates(
      auth.countryId,
      deps.getCountryDivisionTemplates(auth.countryId).filter((template) => template.id !== templateId),
    );
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildMilitaryOverview(auth.countryId));
  });

  app.patch("/military/templates/:templateId/icon", deps.upload.single("divisionIcon"), async (req, res) => {
    const auth = deps.routeAuth.requireAuthOrCleanup(req, res, () =>
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined),
    );
    if (!auth) return;
    return handleTemplateIconUpload(req, res, deps, {
      countryId: auth.countryId,
      templateId: String(req.params.templateId ?? "").trim(),
      overview: "military",
    });
  });

  app.post("/military/formations", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = createMilitaryFormationInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    deps.ensureCountryInWorldBase(auth.countryId);
    const template = deps.getCountryDivisionTemplates(auth.countryId).find((entry) => entry.id === parsed.data.templateId);
    if (!template) {
      return res.status(404).json({ error: "FORMATION_TEMPLATE_NOT_FOUND" });
    }
    const kind = template.kind ?? "land";
    const deployment = deps.validateFormationDeployment(auth.countryId, kind, parsed.data.hexId as HexId);
    if (!deployment.ok) {
      const status = deployment.error === "FORMATION_DEPLOYMENT_BRANCH_UNSUPPORTED" ? 409 : 400;
      return res.status(status).json({ error: deployment.error });
    }
    const components = deps.normalizeMilitaryTemplateComponents(template.components, kind, template.battalions);
    const unitFormationCost = deps.calculateMilitaryFormationCost(kind, components);
    const formationCost = multiplyFormationCost(unitFormationCost, parsed.data.quantity);
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.resourcesByCountry | deps.masks.militaryFormationQueueByCountry,
    );
    const spend = deps.spendMilitaryFormationCost(auth.countryId, formationCost);
    if (!spend.ok) {
      return res.status(409).json({ error: spend.error, ...(isRecord(spend.details) ? spend.details : {}) });
    }
    const turnsTotal = deps.calculateFormationTurns(unitFormationCost);
    const item: MilitaryFormationQueueItem = {
      id: deps.createId(),
      countryId: auth.countryId,
      kind,
      templateId: template.id,
      name: parsed.data.name ?? template.name,
      hexId: parsed.data.hexId as HexId,
      quantity: parsed.data.quantity,
      remainingQuantity: parsed.data.quantity,
      priority: parsed.data.priority,
      repeat: parsed.data.repeat,
      stalledReasonCode: null,
      progress: 0,
      turnsTotal,
      turnsRemaining: turnsTotal,
      cost: formationCost,
      createdTurnId: deps.getTurnId(),
    };
    deps.setCountryMilitaryQueue(auth.countryId, [...deps.getCountryMilitaryQueue(auth.countryId), item]);
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildMilitaryOverview(auth.countryId));
  });

  app.post("/military/equipment/variants", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = createEquipmentVariantInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    deps.ensureCountryInWorldBase(auth.countryId);
    const frames = deps.getEquipmentFrames();
    const equipmentFrame =
      (parsed.data.frameId ? frames.find((entry) => entry.id === parsed.data.frameId) : null) ??
      (parsed.data.classId ? frames.find((entry) => entry.classId === parsed.data.classId) : null);
    if (!equipmentFrame) {
      return res.status(404).json({ error: "EQUIPMENT_FRAME_NOT_FOUND" });
    }
    const equipmentClass = deps.getEquipmentClasses().find((entry) => entry.id === equipmentFrame.classId);
    if (!equipmentClass) {
      return res.status(404).json({ error: "EQUIPMENT_CLASS_NOT_FOUND" });
    }
    const modulesById = Object.fromEntries(deps.getEquipmentModules().map((entry) => [entry.id, entry]));
    for (const slotId of equipmentFrame.slotIds) {
      const moduleId = parsed.data.moduleIdsBySlotId[slotId];
      if (!moduleId) {
        return res.status(400).json({ error: "EQUIPMENT_SLOT_EMPTY", slotId });
      }
      const module = modulesById[moduleId];
      if (!module || module.slotId !== slotId || (module.classId && module.classId !== equipmentClass.id)) {
        return res.status(400).json({ error: "EQUIPMENT_MODULE_INVALID", slotId, moduleId });
      }
    }
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.unitEquipmentState);
    const id = `equipment_variant:${auth.countryId}:${deps.createId()}`;
    deps.getEquipmentVariantsById()[id] = deriveEquipmentVariant({
      id,
      countryId: auth.countryId,
      equipmentClass,
      equipmentFrame,
      modulesById,
      moduleIdsBySlotId: parsed.data.moduleIdsBySlotId,
      name: parsed.data.name,
      createdTurnId: deps.getTurnId(),
    });
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildMilitaryOverview(auth.countryId));
  });

  app.delete("/military/divisions/:divisionId", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    deps.ensureCountryInWorldBase(auth.countryId);
    const divisionId = String(req.params.divisionId ?? "").trim();
    if (!divisionId) return res.status(400).json({ error: "INVALID_DIVISION_ID" });
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.divisionsById | deps.masks.unitEquipmentState);
    if (!disbandDivision(divisionId, auth.countryId)) {
      return res.status(404).json({ error: "DIVISION_NOT_FOUND" });
    }
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildMilitaryOverview(auth.countryId));
  });

  app.patch("/military/divisions/:divisionId/supply-priority", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = divisionSupplyPriorityInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    deps.ensureCountryInWorldBase(auth.countryId);
    const divisionId = String(req.params.divisionId ?? "").trim();
    if (!divisionId) return res.status(400).json({ error: "INVALID_DIVISION_ID" });
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.divisionsById | deps.masks.unitEquipmentState);
    if (!setDivisionSupplyPriority(divisionId, auth.countryId, parsed.data.supplyPriority)) {
      return res.status(404).json({ error: "DIVISION_NOT_FOUND" });
    }
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildMilitaryOverview(auth.countryId));
  });

  app.patch("/military/air-wings/:airWingId/mission", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = airWingMissionInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    deps.ensureCountryInWorldBase(auth.countryId);
    const airWingId = String(req.params.airWingId ?? "").trim();
    if (!airWingId) return res.status(400).json({ error: "INVALID_AIR_WING_ID" });
    const targetRegionId = parsed.data.mission === "none" ? null : parsed.data.targetRegionId?.trim() || null;
    if (parsed.data.mission !== "none" && !targetRegionId) {
      return res.status(400).json({ error: "AIR_WING_TARGET_REGION_REQUIRED" });
    }
    if (targetRegionId && !deps.getKnownRegionIds().includes(targetRegionId)) {
      return res.status(404).json({ error: "AIR_WING_TARGET_REGION_NOT_FOUND" });
    }
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.unitEquipmentState);
    if (!setAirWingMission(airWingId, auth.countryId, parsed.data.mission, targetRegionId)) {
      return res.status(404).json({ error: "AIR_WING_NOT_FOUND" });
    }
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildMilitaryOverview(auth.countryId));
  });

  app.post("/military/equipment/production-lines", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = createEquipmentProductionLineInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    deps.ensureCountryInWorldBase(auth.countryId);
    const variant = deps.getEquipmentVariantsById()[parsed.data.equipmentVariantId];
    if (!variant || (variant.countryId && variant.countryId !== auth.countryId)) {
      return res.status(404).json({ error: "EQUIPMENT_VARIANT_NOT_FOUND" });
    }
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.unitEquipmentState);
    const line: EquipmentProductionLine = {
      id: `equipment_line:${auth.countryId}:${deps.createId()}`,
      countryId: auth.countryId,
      equipmentVariantId: variant.id,
      assignedCapacity: Number(parsed.data.assignedCapacity.toFixed(3)),
      progress: 0,
      active: parsed.data.active ?? true,
      createdTurnId: deps.getTurnId(),
    };
    deps.setCountryEquipmentProductionLines(auth.countryId, [...deps.getCountryEquipmentProductionLines(auth.countryId), line]);
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildMilitaryOverview(auth.countryId));
  });

  app.patch("/military/equipment/production-lines/:lineId", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = updateEquipmentProductionLineInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    deps.ensureCountryInWorldBase(auth.countryId);
    const lineId = String(req.params.lineId ?? "").trim();
    const lines = deps.getCountryEquipmentProductionLines(auth.countryId);
    const existing = lines.find((line) => line.id === lineId);
    if (!existing) {
      return res.status(404).json({ error: "EQUIPMENT_PRODUCTION_LINE_NOT_FOUND" });
    }
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.unitEquipmentState);
    deps.setCountryEquipmentProductionLines(
      auth.countryId,
      lines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              assignedCapacity:
                typeof parsed.data.assignedCapacity === "number"
                  ? Number(parsed.data.assignedCapacity.toFixed(3))
                  : line.assignedCapacity,
              active: typeof parsed.data.active === "boolean" ? parsed.data.active : line.active,
            }
          : line,
      ),
    );
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildMilitaryOverview(auth.countryId));
  });

  app.delete("/military/equipment/production-lines/:lineId", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    deps.ensureCountryInWorldBase(auth.countryId);
    const lineId = String(req.params.lineId ?? "").trim();
    const lines = deps.getCountryEquipmentProductionLines(auth.countryId);
    if (!lines.some((line) => line.id === lineId)) {
      return res.status(404).json({ error: "EQUIPMENT_PRODUCTION_LINE_NOT_FOUND" });
    }
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.unitEquipmentState);
    deps.setCountryEquipmentProductionLines(auth.countryId, lines.filter((line) => line.id !== lineId));
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildMilitaryOverview(auth.countryId));
  });

  app.delete("/military/formations/:queueId", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const queueId = String(req.params.queueId ?? "").trim();
    const queue = deps.getCountryMilitaryQueue(auth.countryId);
    if (!queue.some((item) => item.id === queueId)) {
      return res.status(404).json({ error: "QUEUE_ITEM_NOT_FOUND" });
    }
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.militaryFormationQueueByCountry);
    deps.setCountryMilitaryQueue(auth.countryId, queue.filter((item) => item.id !== queueId));
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildMilitaryOverview(auth.countryId));
  });

  app.post("/army/templates", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = divisionTemplateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }
    deps.ensureCountryInWorldBase(auth.countryId);
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.divisionTemplatesByCountry | deps.masks.divisionsById,
    );
    const existing = [...deps.getCountryDivisionTemplates(auth.countryId)];
    const templateId = parsed.data.templateId ?? deps.createId();
    const battalions = parsed.data.battalions.map((battalion) => ({
      id: battalion.id ?? deps.createId(),
      battalionTypeId: battalion.battalionTypeId,
      count: battalion.count,
    }));
    if (battalions.some((battalion) => !deps.getBattalionContentById(battalion.battalionTypeId))) {
      return res.status(400).json({ error: "UNKNOWN_BATTALION_TYPE" });
    }
    const previousTemplate = existing.find((entry) => entry.id === templateId);
    const template: DivisionTemplate = {
      id: templateId,
      countryId: auth.countryId,
      name: parsed.data.name,
      iconUrl: parsed.data.iconUrl ?? previousTemplate?.iconUrl ?? null,
      battalions,
      stats: deps.calculateDivisionStats(battalions),
      createdTurnId: previousTemplate?.createdTurnId ?? deps.getTurnId(),
      updatedTurnId: deps.getTurnId(),
    };
    deps.setCountryDivisionTemplates(
      auth.countryId,
      existing.some((entry) => entry.id === templateId)
        ? existing.map((entry) => (entry.id === templateId ? template : entry))
        : [...existing, template],
    );

    for (const division of Object.values(deps.getCountryDivisionsById())) {
      if (division.countryId === auth.countryId && division.templateId === template.id) {
        division.stats = template.stats;
        division.organization = Math.min(division.organization, template.stats.organization);
      }
    }

    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildArmyOverview(auth.countryId));
  });

  app.delete("/army/templates/:templateId", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const templateId = String(req.params.templateId ?? "").trim();
    const hasDivision = Object.values(deps.getCountryDivisionsById()).some(
      (division) => division.countryId === auth.countryId && division.templateId === templateId,
    );
    if (hasDivision) {
      return res.status(409).json({ error: "TEMPLATE_IN_USE" });
    }
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.divisionTemplatesByCountry);
    deps.setCountryDivisionTemplates(
      auth.countryId,
      deps.getCountryDivisionTemplates(auth.countryId).filter((template) => template.id !== templateId),
    );
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildArmyOverview(auth.countryId));
  });

  app.patch("/army/templates/:templateId/icon", deps.upload.single("divisionIcon"), async (req, res) => {
    const auth = deps.routeAuth.requireAuthOrCleanup(req, res, () =>
      deps.removeUploadedFile(req.file as Express.Multer.File | undefined),
    );
    if (!auth) return;
    return handleTemplateIconUpload(req, res, deps, {
      countryId: auth.countryId,
      templateId: String(req.params.templateId ?? "").trim(),
      overview: "army",
    });
  });

  app.post("/army/divisions", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = createDivisionInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }
    deps.ensureCountryInWorldBase(auth.countryId);
    if (deps.getHexOwner(parsed.data.hexId) !== auth.countryId) {
      return res.status(403).json({ error: "HEX_NOT_OWNED" });
    }
    const template = deps.getCountryDivisionTemplates(auth.countryId).find((entry) => entry.id === parsed.data.templateId);
    if (!template) {
      return res.status(404).json({ error: "TEMPLATE_NOT_FOUND" });
    }
    const trainingCost = deps.calculateDivisionTrainingCost(template.battalions);
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(
      deps.masks.resourcesByCountry | deps.masks.divisionsById,
    );
    const spend = deps.spendDivisionTrainingCost(auth.countryId, trainingCost);
    if (!spend.ok) {
      return res.status(409).json({ error: spend.error, ...(isRecord(spend.details) ? spend.details : {}) });
    }
    const division: Division = {
      id: deps.createId(),
      countryId: auth.countryId,
      templateId: template.id,
      name: parsed.data.name ?? template.name,
      hexId: parsed.data.hexId as HexId,
      strength: 1,
      organization: template.stats.organization,
      stats: template.stats,
      status: "idle",
      path: [],
      createdTurnId: deps.getTurnId(),
      lastMovedTurnId: null,
    };
    deps.getCountryDivisionsById()[division.id] = division;
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildArmyOverview(auth.countryId));
  });

  app.delete("/army/divisions/:divisionId", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    deps.ensureCountryInWorldBase(auth.countryId);
    const divisionId = String(req.params.divisionId ?? "").trim();
    if (!divisionId) return res.status(400).json({ error: "INVALID_DIVISION_ID" });
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.divisionsById | deps.masks.unitEquipmentState);
    if (!disbandDivision(divisionId, auth.countryId)) {
      return res.status(404).json({ error: "DIVISION_NOT_FOUND" });
    }
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildArmyOverview(auth.countryId));
  });

  app.patch("/army/divisions/:divisionId/supply-priority", async (req, res) => {
    const auth = deps.routeAuth.requireAuth(req, res);
    if (!auth) return;
    const parsed = divisionSupplyPriorityInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    deps.ensureCountryInWorldBase(auth.countryId);
    const divisionId = String(req.params.divisionId ?? "").trim();
    if (!divisionId) return res.status(400).json({ error: "INVALID_DIVISION_ID" });
    const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.divisionsById | deps.masks.unitEquipmentState);
    if (!setDivisionSupplyPriority(divisionId, auth.countryId, parsed.data.supplyPriority)) {
      return res.status(404).json({ error: "DIVISION_NOT_FOUND" });
    }
    deps.savePersistentState();
    deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
    return res.json(deps.buildArmyOverview(auth.countryId));
  });
}

function handleTemplateIconUpload(
  req: express.Request,
  res: express.Response,
  deps: MilitaryRoutesDependencies,
  params: { countryId: string; templateId: string; overview: "army" | "military" },
): express.Response {
  const templates = [...deps.getCountryDivisionTemplates(params.countryId)];
  const index = templates.findIndex((template) => template.id === params.templateId);
  if (index < 0) {
    deps.removeUploadedFile(req.file as Express.Multer.File | undefined);
    return res.status(404).json({ error: "TEMPLATE_NOT_FOUND" });
  }
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    return res.status(400).json({ error: "NO_FILE" });
  }
  const validation = deps.validateTemplateIcon(file);
  if (validation !== "ok") {
    deps.removeUploadedFile(file);
    return res.status(400).json({ error: validation });
  }
  const previousWorldBase = deps.cloneWorldBaseSectionSnapshot(deps.masks.divisionTemplatesByCountry);
  const previousUrl = templates[index].iconUrl;
  templates[index] = {
    ...templates[index],
    iconUrl: deps.makeVersionedUploadUrl(`division-icons/${file.filename}`),
    updatedTurnId: deps.getTurnId(),
  };
  deps.setCountryDivisionTemplates(params.countryId, templates);
  if (previousUrl) deps.removeUploadedByUrl(previousUrl);
  deps.savePersistentState();
  deps.broadcastWorldDeltaFromSectionSnapshot(previousWorldBase);
  return res.json(params.overview === "army" ? deps.buildArmyOverview(params.countryId) : deps.buildMilitaryOverview(params.countryId));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function multiplyFormationCost(cost: MilitaryFormationCost, quantity: number): MilitaryFormationCost {
  const multiplier = Math.max(1, Math.floor(Number(quantity) || 1));
  return {
    ducats: Number((Math.max(0, Number(cost.ducats) || 0) * multiplier).toFixed(3)),
    manpower: Number((Math.max(0, Number(cost.manpower) || 0) * multiplier).toFixed(3)),
    equipmentNeeds: cost.equipmentNeeds.map((need) => ({
      goodId: need.goodId,
      amount: Number((Math.max(0, Number(need.amount) || 0) * multiplier).toFixed(3)),
    })),
  };
}
