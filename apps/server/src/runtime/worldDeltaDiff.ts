import type {
  BuildingInstance,
  AirWing,
  Division,
  DivisionTemplate,
  Fleet,
  MilitaryFormationQueueItem,
  RegionConstructionProject,
  RegionPopulation,
  RegionResourceDeposit,
  RegionResourceExplorationProject,
  ResourceTotals,
  WorldBase,
  WorldDelta,
} from "@arcanorum/shared";
import { WORLD_DELTA_MASK } from "@arcanorum/shared";
import { getDirtySnapshotMask } from "./worldDeltaDirtyTracker";

export type CompactWorldDeltaPayload = Omit<WorldDelta, "type" | "turnId" | "worldStateVersion" | "rejectedOrders">;

export type BaselineWorldDeltaPayload = {
  type: "WORLD_DELTA";
  turnId: number;
  worldStateVersion: number;
  changes: {
    resourcesByCountry?: WorldDelta["c"];
    resourceLedgerByTurn?: WorldDelta["l"];
    explanationRecordsByTurn?: WorldDelta["xr"];
    regionOwner?: WorldDelta["a"];
    regionController?: WorldDelta["f"];
    hexOwner?: WorldDelta["o"];
    hexNameById?: WorldDelta["n"];
    colonyProgressByRegion?: WorldDelta["p"];
    regionColonizationByRegion?: WorldDelta["z"];
    regionPopulationByRegion?: WorldDelta["u"];
    regionBuildingsByRegion?: WorldDelta["b"];
    regionBuildingDucatsByRegion?: WorldDelta["q"];
    regionPopulationTreasuryByRegion?: WorldDelta["y"];
    regionConstructionQueueByRegion?: WorldDelta["r"];
    regionResourceDepositsByRegion?: WorldDelta["t"];
    regionResourceExplorationQueueByRegion?: WorldDelta["e"];
    regionResourceExplorationCountByRegion?: WorldDelta["k"];
    parliamentByCountry?: WorldDelta["m"];
    technologyByCountry?: WorldDelta["h"];
    countryDecisionsByCountryId?: WorldDelta["d"];
    countryEventsByCountryId?: WorldDelta["v"];
    countryScheduledEventsByCountryId?: WorldDelta["s"];
    countryEventFlagsByCountryId?: WorldDelta["xg"];
    journalEntriesByCountryId?: WorldDelta["jo"];
    countryModifiersByCountryId?: WorldDelta["cm"];
    unitsById?: WorldDelta["mu"];
    unitTrainingQueueByCountry?: WorldDelta["uq"];
    divisionTemplatesByCountry?: WorldDelta["g"];
    divisionsById?: WorldDelta["x"];
    militaryFormationQueueByCountry?: WorldDelta["w"];
    fleetsById?: WorldDelta["fl"];
    airWingsById?: WorldDelta["aw"];
    civilianUnitsById?: WorldDelta["cu"];
    civilianUnitQueueByCountry?: WorldDelta["cq"];
    settlementProjectsById?: WorldDelta["sp"];
    cityMarkersById?: WorldDelta["ci"];
    equipmentVariantsById?: WorldDelta["ev"];
    equipmentProductionLinesByCountry?: WorldDelta["el"];
    equipmentStockpileByCountry?: WorldDelta["es"];
    diplomacyProposals?: WorldDelta["j"];
  };
  rejectedOrders: WorldDelta["rejectedOrders"];
};

export function buildWorldDeltaPayload(params: {
  turnId: number;
  worldStateVersion: number;
  compact: CompactWorldDeltaPayload;
  rejectedOrders: WorldDelta["rejectedOrders"];
}): WorldDelta {
  return {
    type: "WORLD_DELTA",
    turnId: params.turnId,
    worldStateVersion: params.worldStateVersion,
    mask: params.compact.mask,
    c: params.compact.c,
    l: params.compact.l,
    xr: params.compact.xr,
    a: params.compact.a,
    f: params.compact.f,
    o: params.compact.o,
    n: params.compact.n,
    p: params.compact.p,
    z: params.compact.z,
    u: params.compact.u,
    b: params.compact.b,
    q: params.compact.q,
    y: params.compact.y,
    r: params.compact.r,
    t: params.compact.t,
    e: params.compact.e,
    k: params.compact.k,
    m: params.compact.m,
    h: params.compact.h,
    d: params.compact.d,
    v: params.compact.v,
    s: params.compact.s,
    xg: params.compact.xg,
    jo: params.compact.jo,
    cm: params.compact.cm,
    mu: params.compact.mu,
    uq: params.compact.uq,
    g: params.compact.g,
    x: params.compact.x,
    w: params.compact.w,
    fl: params.compact.fl,
    aw: params.compact.aw,
    cu: params.compact.cu,
    cq: params.compact.cq,
    sp: params.compact.sp,
    ci: params.compact.ci,
    ev: params.compact.ev,
    el: params.compact.el,
    es: params.compact.es,
    j: params.compact.j,
    rejectedOrders: params.rejectedOrders,
  };
}

export function buildBaselineWorldDeltaPayload(params: {
  turnId: number;
  worldStateVersion: number;
  compact: CompactWorldDeltaPayload;
  rejectedOrders: WorldDelta["rejectedOrders"];
}): BaselineWorldDeltaPayload {
  return {
    type: "WORLD_DELTA",
    turnId: params.turnId,
    worldStateVersion: params.worldStateVersion,
    changes: {
      resourcesByCountry: params.compact.c,
      resourceLedgerByTurn: params.compact.l,
      explanationRecordsByTurn: params.compact.xr,
      regionOwner: params.compact.a,
      regionController: params.compact.f,
      hexOwner: params.compact.o,
      hexNameById: params.compact.n,
      colonyProgressByRegion: params.compact.p,
      regionColonizationByRegion: params.compact.z,
      regionPopulationByRegion: params.compact.u,
      regionBuildingsByRegion: params.compact.b,
      regionBuildingDucatsByRegion: params.compact.q,
      regionPopulationTreasuryByRegion: params.compact.y,
      regionConstructionQueueByRegion: params.compact.r,
      regionResourceDepositsByRegion: params.compact.t,
      regionResourceExplorationQueueByRegion: params.compact.e,
      regionResourceExplorationCountByRegion: params.compact.k,
      parliamentByCountry: params.compact.m,
      technologyByCountry: params.compact.h,
      countryDecisionsByCountryId: params.compact.d,
      countryEventsByCountryId: params.compact.v,
      countryScheduledEventsByCountryId: params.compact.s,
      countryEventFlagsByCountryId: params.compact.xg,
      journalEntriesByCountryId: params.compact.jo,
      countryModifiersByCountryId: params.compact.cm,
      unitsById: params.compact.mu,
      unitTrainingQueueByCountry: params.compact.uq,
      divisionTemplatesByCountry: params.compact.g,
      divisionsById: params.compact.x,
      militaryFormationQueueByCountry: params.compact.w,
      fleetsById: params.compact.fl,
      airWingsById: params.compact.aw,
      civilianUnitsById: params.compact.cu,
      civilianUnitQueueByCountry: params.compact.cq,
      settlementProjectsById: params.compact.sp,
      cityMarkersById: params.compact.ci,
      equipmentVariantsById: params.compact.ev,
      equipmentProductionLinesByCountry: params.compact.el,
      equipmentStockpileByCountry: params.compact.es,
      diplomacyProposals: params.compact.j,
    },
    rejectedOrders: params.rejectedOrders,
  };
}

export type WorldBaseSectionSnapshot = {
  turnId: number;
  mask: number;
  resourcesByCountry?: WorldBase["resourcesByCountry"];
  resourceLedgerByTurn?: WorldBase["resourceLedgerByTurn"];
  explanationRecordsByTurn?: WorldBase["explanationRecordsByTurn"];
  regionOwner?: WorldBase["regionOwner"];
  regionController?: WorldBase["regionController"];
  hexOwner?: WorldBase["hexOwner"];
  hexNameById?: WorldBase["hexNameById"];
  colonyProgressByRegion?: WorldBase["colonyProgressByRegion"];
  regionColonizationByRegion?: WorldBase["regionColonizationByRegion"];
  regionPopulationByRegion?: WorldBase["regionPopulationByRegion"];
  regionBuildingsByRegion?: WorldBase["regionBuildingsByRegion"];
  regionBuildingDucatsByRegion?: WorldBase["regionBuildingDucatsByRegion"];
  regionPopulationTreasuryByRegion?: WorldBase["regionPopulationTreasuryByRegion"];
  regionConstructionQueueByRegion?: WorldBase["regionConstructionQueueByRegion"];
  regionResourceDepositsByRegion?: WorldBase["regionResourceDepositsByRegion"];
  regionResourceExplorationQueueByRegion?: WorldBase["regionResourceExplorationQueueByRegion"];
  regionResourceExplorationCountByRegion?: WorldBase["regionResourceExplorationCountByRegion"];
  parliamentByCountry?: WorldBase["parliamentByCountry"];
  technologyByCountry?: WorldBase["technologyByCountry"];
  countryDecisionsByCountryId?: WorldBase["countryDecisionsByCountryId"];
  countryEventsByCountryId?: WorldBase["countryEventsByCountryId"];
  countryScheduledEventsByCountryId?: WorldBase["countryScheduledEventsByCountryId"];
  countryEventFlagsByCountryId?: WorldBase["countryEventFlagsByCountryId"];
  journalEntriesByCountryId?: WorldBase["journalEntriesByCountryId"];
  countryModifiersByCountryId?: WorldBase["countryModifiersByCountryId"];
  unitsById?: WorldBase["unitsById"];
  unitTrainingQueueByCountry?: WorldBase["unitTrainingQueueByCountry"];
  divisionTemplatesByCountry?: WorldBase["divisionTemplatesByCountry"];
  divisionsById?: WorldBase["divisionsById"];
  militaryFormationQueueByCountry?: WorldBase["militaryFormationQueueByCountry"];
  fleetsById?: WorldBase["fleetsById"];
  airWingsById?: WorldBase["airWingsById"];
  civilianUnitsById?: WorldBase["civilianUnitsById"];
  civilianUnitQueueByCountry?: WorldBase["civilianUnitQueueByCountry"];
  settlementProjectsById?: WorldBase["settlementProjectsById"];
  cityMarkersById?: WorldBase["cityMarkersById"];
  equipmentVariantsById?: WorldBase["equipmentVariantsById"];
  equipmentProductionLinesByCountry?: WorldBase["equipmentProductionLinesByCountry"];
  equipmentStockpileByCountry?: WorldBase["equipmentStockpileByCountry"];
  diplomacyProposals?: WorldBase["diplomacyProposals"];
};

export function cloneDirtyWorldBaseSectionSnapshot(params: {
  worldBase: WorldBase;
  turnId: number;
  requestedMask: number;
  dirtyMask: number;
}): WorldBaseSectionSnapshot {
  return cloneWorldBaseSectionSnapshot({
    worldBase: params.worldBase,
    turnId: params.turnId,
    mask: getDirtySnapshotMask({
      requestedMask: params.requestedMask,
      dirtyMask: params.dirtyMask,
    }),
  });
}

export function cloneWorldBaseSectionSnapshot(params: {
  worldBase: WorldBase;
  turnId: number;
  mask: number;
}): WorldBaseSectionSnapshot {
  const { worldBase, turnId, mask } = params;
  const snapshot: WorldBaseSectionSnapshot = {
    turnId,
    mask,
  };

  if ((mask & WORLD_DELTA_MASK.resourcesByCountry) !== 0) {
    snapshot.resourcesByCountry = structuredClone(worldBase.resourcesByCountry);
  }
  if ((mask & WORLD_DELTA_MASK.resourceLedgerByTurn) !== 0) {
    snapshot.resourceLedgerByTurn = structuredClone(worldBase.resourceLedgerByTurn);
  }
  if ((mask & WORLD_DELTA_MASK.explanationRecordsByTurn) !== 0) {
    snapshot.explanationRecordsByTurn = structuredClone(worldBase.explanationRecordsByTurn);
  }
  if ((mask & WORLD_DELTA_MASK.regionOwner) !== 0) {
    snapshot.regionOwner = { ...worldBase.regionOwner };
  }
  if ((mask & WORLD_DELTA_MASK.regionController) !== 0) {
    snapshot.regionController = { ...worldBase.regionController };
  }
  if ((mask & WORLD_DELTA_MASK.hexOwner) !== 0) {
    snapshot.hexOwner = { ...worldBase.hexOwner };
  }
  if ((mask & WORLD_DELTA_MASK.hexNameById) !== 0) {
    snapshot.hexNameById = { ...worldBase.hexNameById };
  }
  if ((mask & WORLD_DELTA_MASK.colonyProgressByRegion) !== 0) {
    snapshot.colonyProgressByRegion = structuredClone(worldBase.colonyProgressByRegion);
  }
  if ((mask & WORLD_DELTA_MASK.regionColonizationByRegion) !== 0) {
    snapshot.regionColonizationByRegion = structuredClone(worldBase.regionColonizationByRegion);
  }
  if ((mask & WORLD_DELTA_MASK.regionPopulationByRegion) !== 0) {
    snapshot.regionPopulationByRegion = structuredClone(worldBase.regionPopulationByRegion);
  }
  if ((mask & WORLD_DELTA_MASK.regionBuildingsByRegion) !== 0) {
    snapshot.regionBuildingsByRegion = structuredClone(worldBase.regionBuildingsByRegion);
  }
  if ((mask & WORLD_DELTA_MASK.regionBuildingDucatsByRegion) !== 0) {
    snapshot.regionBuildingDucatsByRegion = structuredClone(worldBase.regionBuildingDucatsByRegion);
  }
  if ((mask & WORLD_DELTA_MASK.regionPopulationTreasuryByRegion) !== 0) {
    snapshot.regionPopulationTreasuryByRegion = structuredClone(worldBase.regionPopulationTreasuryByRegion);
  }
  if ((mask & WORLD_DELTA_MASK.regionConstructionQueueByRegion) !== 0) {
    snapshot.regionConstructionQueueByRegion = structuredClone(worldBase.regionConstructionQueueByRegion);
  }
  if ((mask & WORLD_DELTA_MASK.regionResourceDepositsByRegion) !== 0) {
    snapshot.regionResourceDepositsByRegion = structuredClone(worldBase.regionResourceDepositsByRegion);
  }
  if ((mask & WORLD_DELTA_MASK.regionResourceExplorationQueueByRegion) !== 0) {
    snapshot.regionResourceExplorationQueueByRegion = structuredClone(
      worldBase.regionResourceExplorationQueueByRegion,
    );
  }
  if ((mask & WORLD_DELTA_MASK.regionResourceExplorationCountByRegion) !== 0) {
    snapshot.regionResourceExplorationCountByRegion = structuredClone(
      worldBase.regionResourceExplorationCountByRegion,
    );
  }
  if ((mask & WORLD_DELTA_MASK.parliamentByCountry) !== 0) {
    snapshot.parliamentByCountry = structuredClone(worldBase.parliamentByCountry);
  }
  if ((mask & WORLD_DELTA_MASK.technologyByCountry) !== 0) {
    snapshot.technologyByCountry = structuredClone(worldBase.technologyByCountry);
  }
  if ((mask & WORLD_DELTA_MASK.countryDecisionsByCountryId) !== 0) {
    snapshot.countryDecisionsByCountryId = structuredClone(worldBase.countryDecisionsByCountryId);
  }
  if ((mask & WORLD_DELTA_MASK.countryEventsByCountryId) !== 0) {
    snapshot.countryEventsByCountryId = structuredClone(worldBase.countryEventsByCountryId);
  }
  if ((mask & WORLD_DELTA_MASK.countryScheduledEventsByCountryId) !== 0) {
    snapshot.countryScheduledEventsByCountryId = structuredClone(worldBase.countryScheduledEventsByCountryId);
  }
  if ((mask & WORLD_DELTA_MASK.countryEventFlagsByCountryId) !== 0) {
    snapshot.countryEventFlagsByCountryId = structuredClone(worldBase.countryEventFlagsByCountryId);
  }
  if ((mask & WORLD_DELTA_MASK.journalEntriesByCountryId) !== 0) {
    snapshot.journalEntriesByCountryId = structuredClone(worldBase.journalEntriesByCountryId);
  }
  if ((mask & WORLD_DELTA_MASK.countryModifiersByCountryId) !== 0) {
    snapshot.countryModifiersByCountryId = structuredClone(worldBase.countryModifiersByCountryId);
  }
  if ((mask & WORLD_DELTA_MASK.divisionTemplatesByCountry) !== 0) {
    snapshot.divisionTemplatesByCountry = structuredClone(worldBase.divisionTemplatesByCountry);
  }
  if ((mask & WORLD_DELTA_MASK.divisionsById) !== 0) {
    snapshot.divisionsById = structuredClone(worldBase.divisionsById);
  }
  if ((mask & WORLD_DELTA_MASK.militaryFormationQueueByCountry) !== 0) {
    snapshot.militaryFormationQueueByCountry = structuredClone(worldBase.militaryFormationQueueByCountry);
  }
  if ((mask & WORLD_DELTA_MASK.unitEquipmentState) !== 0) {
    snapshot.unitsById = structuredClone(worldBase.unitsById ?? {});
    snapshot.unitTrainingQueueByCountry = structuredClone(worldBase.unitTrainingQueueByCountry ?? {});
    snapshot.fleetsById = structuredClone(worldBase.fleetsById);
    snapshot.airWingsById = structuredClone(worldBase.airWingsById);
    snapshot.civilianUnitsById = structuredClone(worldBase.civilianUnitsById);
    snapshot.civilianUnitQueueByCountry = structuredClone(worldBase.civilianUnitQueueByCountry);
    snapshot.settlementProjectsById = structuredClone(worldBase.settlementProjectsById);
    snapshot.cityMarkersById = structuredClone(worldBase.cityMarkersById);
    snapshot.equipmentVariantsById = structuredClone(worldBase.equipmentVariantsById);
    snapshot.equipmentProductionLinesByCountry = structuredClone(worldBase.equipmentProductionLinesByCountry);
    snapshot.equipmentStockpileByCountry = structuredClone(worldBase.equipmentStockpileByCountry);
  }
  if ((mask & WORLD_DELTA_MASK.diplomacyProposals) !== 0) {
    snapshot.diplomacyProposals = structuredClone(worldBase.diplomacyProposals);
  }

  return snapshot;
}

export type PreparedWorldDeltaBroadcast =
  | { ok: false }
  | {
      ok: true;
      nextWorldStateVersion: number;
      payload: WorldDelta;
      baselinePayload?: BaselineWorldDeltaPayload;
      buildBaselinePayload: () => BaselineWorldDeltaPayload;
    };

export function prepareWorldDeltaBroadcast(params: {
  previous: WorldBaseSectionSnapshot;
  next: WorldBase;
  turnId: number;
  currentWorldStateVersion: number;
  rejectedOrders: WorldDelta["rejectedOrders"];
  isEqualRegionPopulation: (prevValue: RegionPopulation | undefined, nextValue: RegionPopulation) => boolean;
  buildBaselinePayload?: boolean;
}): PreparedWorldDeltaBroadcast {
  const prevForDiff = toWorldBaseForDeltaDiff(params.previous, params.next);
  const compact = buildCompactWorldDelta({
    prev: prevForDiff,
    next: params.next,
    isEqualRegionPopulation: params.isEqualRegionPopulation,
  });
  if (compact.mask === 0 && params.rejectedOrders.length === 0) {
    return { ok: false };
  }

  const nextWorldStateVersion = params.currentWorldStateVersion + 1;
  const buildBaselinePayload = () => buildBaselineWorldDeltaPayload({
    turnId: params.turnId,
    worldStateVersion: nextWorldStateVersion,
    compact,
    rejectedOrders: params.rejectedOrders,
  });
  return {
    ok: true,
    nextWorldStateVersion,
    payload: buildWorldDeltaPayload({
      turnId: params.turnId,
      worldStateVersion: nextWorldStateVersion,
      compact,
      rejectedOrders: params.rejectedOrders,
    }),
    baselinePayload: params.buildBaselinePayload === false ? undefined : buildBaselinePayload(),
    buildBaselinePayload,
  };
}

export function buildCompactWorldDelta(params: {
  prev: WorldBase;
  next: WorldBase;
  isEqualRegionPopulation: (prevValue: RegionPopulation | undefined, nextValue: RegionPopulation) => boolean;
}): CompactWorldDeltaPayload {
  const { prev, next } = params;
  const resourcesByCountry: Record<string, ResourceTotals | null> = {};
  const resourceLedgerByTurn: WorldDelta["l"] = {};
  const explanationRecordsByTurn: WorldDelta["xr"] = {};
  const regionOwner: Record<string, string | null> = {};
  const regionController: Record<string, string | null> = {};
  const hexOwner: Record<string, string | null> = {};
  const hexNameById: Record<string, string | null> = {};
  const colonyProgressByRegion: Record<string, Record<string, number> | null> = {};
  const regionColonizationByRegion: Record<string, { cost: number; disabled: boolean; manualCost?: boolean } | null> = {};
  const regionPopulationByRegion: Record<string, RegionPopulation | null> = {};
  const regionBuildingsByRegion: Record<string, BuildingInstance[] | null> = {};
  const regionBuildingDucatsByRegion: Record<string, Record<string, number> | null> = {};
  const regionPopulationTreasuryByRegion: Record<string, number | null> = {};
  const regionConstructionQueueByRegion: Record<string, RegionConstructionProject[] | null> = {};
  const regionResourceDepositsByRegion: Record<string, RegionResourceDeposit[] | null> = {};
  const regionResourceExplorationQueueByRegion: Record<string, RegionResourceExplorationProject[] | null> = {};
  const regionResourceExplorationCountByRegion: Record<string, number | null> = {};
  const parliamentByCountry: Record<string, WorldBase["parliamentByCountry"][string] | null> = {};
  const technologyByCountry: Record<string, WorldBase["technologyByCountry"][string] | null> = {};
  const countryDecisionsByCountryId: Record<string, WorldBase["countryDecisionsByCountryId"][string] | null> = {};
  const countryEventsByCountryId: Record<string, WorldBase["countryEventsByCountryId"][string] | null> = {};
  const countryScheduledEventsByCountryId: Record<string, WorldBase["countryScheduledEventsByCountryId"][string] | null> = {};
  const countryEventFlagsByCountryId: Record<string, WorldBase["countryEventFlagsByCountryId"][string] | null> = {};
  const journalEntriesByCountryId: Record<string, WorldBase["journalEntriesByCountryId"][string] | null> = {};
  const countryModifiersByCountryId: Record<string, WorldBase["countryModifiersByCountryId"][string] | null> = {};
  const unitsById: WorldDelta["mu"] = {};
  const unitTrainingQueueByCountry: WorldDelta["uq"] = {};
  const divisionTemplatesByCountry: Record<string, DivisionTemplate[] | null> = {};
  const divisionsById: Record<string, Division | null> = {};
  const militaryFormationQueueByCountry: Record<string, MilitaryFormationQueueItem[] | null> = {};
  const fleetsById: Record<string, Fleet | null> = {};
  const airWingsById: Record<string, AirWing | null> = {};
  const civilianUnitsById: WorldDelta["cu"] = {};
  const civilianUnitQueueByCountry: WorldDelta["cq"] = {};
  const settlementProjectsById: WorldDelta["sp"] = {};
  const cityMarkersById: WorldDelta["ci"] = {};
  const equipmentVariantsById: WorldDelta["ev"] = {};
  const equipmentProductionLinesByCountry: WorldDelta["el"] = {};
  const equipmentStockpileByCountry: WorldDelta["es"] = {};
  const diplomacyProposalsChanged = !isJsonEquivalent(prev.diplomacyProposals ?? [], next.diplomacyProposals ?? []);

  for (const key of new Set([...Object.keys(prev.resourcesByCountry), ...Object.keys(next.resourcesByCountry)])) {
    const prevValue = prev.resourcesByCountry[key];
    const nextValue = next.resourcesByCountry[key];
    if (!nextValue) {
      resourcesByCountry[key] = null;
      continue;
    }
    if (
      !prevValue ||
      prevValue.culture !== nextValue.culture ||
      prevValue.science !== nextValue.science ||
      prevValue.religion !== nextValue.religion ||
      prevValue.colonization !== nextValue.colonization ||
      prevValue.construction !== nextValue.construction ||
      prevValue.ducats !== nextValue.ducats ||
      prevValue.gold !== nextValue.gold
    ) {
      resourcesByCountry[key] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.resourceLedgerByTurn), ...Object.keys(next.resourceLedgerByTurn)])) {
    const turnId = Number(key);
    const prevValue = prev.resourceLedgerByTurn[turnId];
    const nextValue = next.resourceLedgerByTurn[turnId];
    if (!nextValue) {
      resourceLedgerByTurn[turnId] = null;
      continue;
    }
    if (!isJsonEquivalent(prevValue ?? null, nextValue)) {
      resourceLedgerByTurn[turnId] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.explanationRecordsByTurn), ...Object.keys(next.explanationRecordsByTurn)])) {
    const turnId = Number(key);
    const prevValue = prev.explanationRecordsByTurn[turnId];
    const nextValue = next.explanationRecordsByTurn[turnId];
    if (!nextValue) {
      explanationRecordsByTurn[turnId] = null;
      continue;
    }
    if (!isJsonEquivalent(prevValue ?? null, nextValue)) {
      explanationRecordsByTurn[turnId] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.regionOwner), ...Object.keys(next.regionOwner)])) {
    const prevValue = prev.regionOwner[key];
    const nextValue = next.regionOwner[key];
    if (typeof nextValue !== "string") {
      regionOwner[key] = null;
      continue;
    }
    if (prevValue !== nextValue) {
      regionOwner[key] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.regionController), ...Object.keys(next.regionController)])) {
    const prevValue = prev.regionController[key];
    const nextValue = next.regionController[key];
    if (typeof nextValue !== "string") {
      regionController[key] = null;
      continue;
    }
    if (prevValue !== nextValue) {
      regionController[key] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.hexOwner), ...Object.keys(next.hexOwner)])) {
    const prevValue = prev.hexOwner[key];
    const nextValue = next.hexOwner[key];
    if (typeof nextValue !== "string") {
      hexOwner[key] = null;
      continue;
    }
    if (prevValue !== nextValue) {
      hexOwner[key] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.hexNameById), ...Object.keys(next.hexNameById)])) {
    const prevValue = prev.hexNameById[key];
    const nextValue = next.hexNameById[key];
    if (typeof nextValue !== "string") {
      hexNameById[key] = null;
      continue;
    }
    if (prevValue !== nextValue) {
      hexNameById[key] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.colonyProgressByRegion), ...Object.keys(next.colonyProgressByRegion)])) {
    const prevValue = prev.colonyProgressByRegion[key];
    const nextValue = next.colonyProgressByRegion[key];
    if (!nextValue) {
      colonyProgressByRegion[key] = null;
      continue;
    }
    if (!isEqualCountryProgressMap(prevValue, nextValue)) {
      colonyProgressByRegion[key] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.regionColonizationByRegion), ...Object.keys(next.regionColonizationByRegion)])) {
    const prevValue = prev.regionColonizationByRegion[key];
    const nextValue = next.regionColonizationByRegion[key];
    if (!nextValue) {
      regionColonizationByRegion[key] = null;
      continue;
    }
    if (
      !prevValue ||
      prevValue.cost !== nextValue.cost ||
      prevValue.disabled !== nextValue.disabled ||
      Boolean(prevValue.manualCost) !== Boolean(nextValue.manualCost)
    ) {
      regionColonizationByRegion[key] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.regionPopulationByRegion), ...Object.keys(next.regionPopulationByRegion)])) {
    const prevValue = prev.regionPopulationByRegion[key];
    const nextValue = next.regionPopulationByRegion[key];
    if (!nextValue) {
      regionPopulationByRegion[key] = null;
      continue;
    }
    if (!params.isEqualRegionPopulation(prevValue, nextValue)) {
      regionPopulationByRegion[key] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.regionBuildingsByRegion), ...Object.keys(next.regionBuildingsByRegion)])) {
    const prevValue = prev.regionBuildingsByRegion[key];
    const nextValue = next.regionBuildingsByRegion[key];
    if (!nextValue) {
      regionBuildingsByRegion[key] = null;
      continue;
    }
    if (!isEqualBuildingInstances(prevValue, nextValue)) {
      regionBuildingsByRegion[key] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.regionBuildingDucatsByRegion), ...Object.keys(next.regionBuildingDucatsByRegion)])) {
    const prevValue = prev.regionBuildingDucatsByRegion[key];
    const nextValue = next.regionBuildingDucatsByRegion[key];
    if (!nextValue) {
      regionBuildingDucatsByRegion[key] = null;
      continue;
    }
    if (!isEqualCountryProgressMap(prevValue, nextValue)) {
      regionBuildingDucatsByRegion[key] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.regionPopulationTreasuryByRegion), ...Object.keys(next.regionPopulationTreasuryByRegion)])) {
    const prevValue = prev.regionPopulationTreasuryByRegion[key];
    const nextValue = next.regionPopulationTreasuryByRegion[key];
    if (nextValue == null) {
      regionPopulationTreasuryByRegion[key] = null;
      continue;
    }
    if (prevValue !== nextValue) {
      regionPopulationTreasuryByRegion[key] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.regionConstructionQueueByRegion), ...Object.keys(next.regionConstructionQueueByRegion)])) {
    const prevValue = prev.regionConstructionQueueByRegion[key];
    const nextValue = next.regionConstructionQueueByRegion[key];
    if (!nextValue) {
      regionConstructionQueueByRegion[key] = null;
      continue;
    }
    if (!isEqualConstructionQueue(prevValue, nextValue)) {
      regionConstructionQueueByRegion[key] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.regionResourceDepositsByRegion), ...Object.keys(next.regionResourceDepositsByRegion)])) {
    const prevValue = prev.regionResourceDepositsByRegion[key];
    const nextValue = next.regionResourceDepositsByRegion[key];
    if (!nextValue) {
      regionResourceDepositsByRegion[key] = null;
      continue;
    }
    if (!isEqualResourceDeposits(prevValue, nextValue)) {
      regionResourceDepositsByRegion[key] = nextValue;
    }
  }

  for (
    const key of new Set([
      ...Object.keys(prev.regionResourceExplorationQueueByRegion),
      ...Object.keys(next.regionResourceExplorationQueueByRegion),
    ])
  ) {
    const prevValue = prev.regionResourceExplorationQueueByRegion[key];
    const nextValue = next.regionResourceExplorationQueueByRegion[key];
    if (!nextValue) {
      regionResourceExplorationQueueByRegion[key] = null;
      continue;
    }
    if (!isEqualResourceExplorationQueue(prevValue, nextValue)) {
      regionResourceExplorationQueueByRegion[key] = nextValue;
    }
  }

  for (
    const key of new Set([
      ...Object.keys(prev.regionResourceExplorationCountByRegion),
      ...Object.keys(next.regionResourceExplorationCountByRegion),
    ])
  ) {
    const prevValue = prev.regionResourceExplorationCountByRegion[key];
    const nextValue = next.regionResourceExplorationCountByRegion[key];
    if (nextValue == null) {
      regionResourceExplorationCountByRegion[key] = null;
      continue;
    }
    if (prevValue !== nextValue) {
      regionResourceExplorationCountByRegion[key] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.parliamentByCountry), ...Object.keys(next.parliamentByCountry)])) {
    const prevValue = prev.parliamentByCountry[key];
    const nextValue = next.parliamentByCountry[key];
    if (!nextValue) {
      parliamentByCountry[key] = null;
      continue;
    }
    if (!isJsonEquivalent(prevValue ?? null, nextValue)) {
      parliamentByCountry[key] = nextValue;
    }
  }
  for (const key of new Set([...Object.keys(prev.technologyByCountry), ...Object.keys(next.technologyByCountry)])) {
    const prevValue = prev.technologyByCountry[key];
    const nextValue = next.technologyByCountry[key];
    if (!nextValue) {
      technologyByCountry[key] = null;
      continue;
    }
    if (!isJsonEquivalent(prevValue ?? null, nextValue)) {
      technologyByCountry[key] = nextValue;
    }
  }
  for (const key of new Set([...Object.keys(prev.countryDecisionsByCountryId), ...Object.keys(next.countryDecisionsByCountryId)])) {
    const prevValue = prev.countryDecisionsByCountryId[key];
    const nextValue = next.countryDecisionsByCountryId[key];
    if (!nextValue) {
      countryDecisionsByCountryId[key] = null;
      continue;
    }
    if (!isJsonEquivalent(prevValue ?? null, nextValue)) {
      countryDecisionsByCountryId[key] = nextValue;
    }
  }
  for (const key of new Set([...Object.keys(prev.countryEventsByCountryId), ...Object.keys(next.countryEventsByCountryId)])) {
    const prevValue = prev.countryEventsByCountryId[key];
    const nextValue = next.countryEventsByCountryId[key];
    if (!nextValue) {
      countryEventsByCountryId[key] = null;
      continue;
    }
    if (!isJsonEquivalent(prevValue ?? null, nextValue)) {
      countryEventsByCountryId[key] = nextValue;
    }
  }
  for (
    const key of new Set([
      ...Object.keys(prev.countryScheduledEventsByCountryId),
      ...Object.keys(next.countryScheduledEventsByCountryId),
    ])
  ) {
    const prevValue = prev.countryScheduledEventsByCountryId[key];
    const nextValue = next.countryScheduledEventsByCountryId[key];
    if (!nextValue) {
      countryScheduledEventsByCountryId[key] = null;
      continue;
    }
    if (!isJsonEquivalent(prevValue ?? null, nextValue)) {
      countryScheduledEventsByCountryId[key] = nextValue;
    }
  }
  for (
    const key of new Set([
      ...Object.keys(prev.countryEventFlagsByCountryId),
      ...Object.keys(next.countryEventFlagsByCountryId),
    ])
  ) {
    const prevValue = prev.countryEventFlagsByCountryId[key];
    const nextValue = next.countryEventFlagsByCountryId[key];
    if (!nextValue) {
      countryEventFlagsByCountryId[key] = null;
      continue;
    }
    if (!isJsonEquivalent(prevValue ?? null, nextValue)) {
      countryEventFlagsByCountryId[key] = nextValue;
    }
  }
  for (
    const key of new Set([
      ...Object.keys(prev.journalEntriesByCountryId),
      ...Object.keys(next.journalEntriesByCountryId),
    ])
  ) {
    const prevValue = prev.journalEntriesByCountryId[key];
    const nextValue = next.journalEntriesByCountryId[key];
    if (!nextValue) {
      journalEntriesByCountryId[key] = null;
      continue;
    }
    if (!isJsonEquivalent(prevValue ?? null, nextValue)) {
      journalEntriesByCountryId[key] = nextValue;
    }
  }
  for (
    const key of new Set([
      ...Object.keys(prev.countryModifiersByCountryId),
      ...Object.keys(next.countryModifiersByCountryId),
    ])
  ) {
    const prevValue = prev.countryModifiersByCountryId[key];
    const nextValue = next.countryModifiersByCountryId[key];
    if (!nextValue) {
      countryModifiersByCountryId[key] = null;
      continue;
    }
    if (!isJsonEquivalent(prevValue ?? null, nextValue)) {
      countryModifiersByCountryId[key] = nextValue;
    }
  }
  for (const key of new Set([...Object.keys(prev.divisionTemplatesByCountry), ...Object.keys(next.divisionTemplatesByCountry)])) {
    const prevValue = prev.divisionTemplatesByCountry[key];
    const nextValue = next.divisionTemplatesByCountry[key];
    if (!nextValue) {
      divisionTemplatesByCountry[key] = null;
      continue;
    }
    if (!isJsonEquivalent(prevValue ?? null, nextValue)) {
      divisionTemplatesByCountry[key] = nextValue;
    }
  }
  for (const key of new Set([...Object.keys(prev.divisionsById), ...Object.keys(next.divisionsById)])) {
    const prevValue = prev.divisionsById[key];
    const nextValue = next.divisionsById[key];
    if (!nextValue) {
      divisionsById[key] = null;
      continue;
    }
    if (!isJsonEquivalent(prevValue ?? null, nextValue)) {
      divisionsById[key] = nextValue;
    }
  }
  for (const key of new Set([...Object.keys(prev.militaryFormationQueueByCountry), ...Object.keys(next.militaryFormationQueueByCountry)])) {
    const prevValue = prev.militaryFormationQueueByCountry[key];
    const nextValue = next.militaryFormationQueueByCountry[key];
    if (!nextValue) {
      militaryFormationQueueByCountry[key] = null;
      continue;
    }
    if (!isJsonEquivalent(prevValue ?? null, nextValue)) {
      militaryFormationQueueByCountry[key] = nextValue;
    }
  }
  collectRecordDiff(prev.civilianUnitsById, next.civilianUnitsById, civilianUnitsById);
  collectRecordDiff(prev.unitsById ?? {}, next.unitsById ?? {}, unitsById);
  collectRecordDiff(prev.unitTrainingQueueByCountry ?? {}, next.unitTrainingQueueByCountry ?? {}, unitTrainingQueueByCountry);
  collectRecordDiff(prev.fleetsById, next.fleetsById, fleetsById);
  collectRecordDiff(prev.airWingsById, next.airWingsById, airWingsById);
  collectRecordDiff(prev.civilianUnitQueueByCountry, next.civilianUnitQueueByCountry, civilianUnitQueueByCountry);
  collectRecordDiff(prev.settlementProjectsById, next.settlementProjectsById, settlementProjectsById);
  collectRecordDiff(prev.cityMarkersById, next.cityMarkersById, cityMarkersById);
  collectRecordDiff(prev.equipmentVariantsById, next.equipmentVariantsById, equipmentVariantsById);
  collectRecordDiff(
    prev.equipmentProductionLinesByCountry,
    next.equipmentProductionLinesByCountry,
    equipmentProductionLinesByCountry,
  );
  collectRecordDiff(prev.equipmentStockpileByCountry, next.equipmentStockpileByCountry, equipmentStockpileByCountry);

  let mask = 0;
  const compact: CompactWorldDeltaPayload = { mask: 0 };
  if (Object.keys(resourcesByCountry).length > 0) {
    mask |= WORLD_DELTA_MASK.resourcesByCountry;
    compact.c = resourcesByCountry;
  }
  if (Object.keys(resourceLedgerByTurn).length > 0) {
    mask |= WORLD_DELTA_MASK.resourceLedgerByTurn;
    compact.l = resourceLedgerByTurn;
  }
  if (Object.keys(explanationRecordsByTurn).length > 0) {
    mask |= WORLD_DELTA_MASK.explanationRecordsByTurn;
    compact.xr = explanationRecordsByTurn;
  }
  if (Object.keys(regionOwner).length > 0) {
    mask |= WORLD_DELTA_MASK.regionOwner;
    compact.a = regionOwner;
  }
  if (Object.keys(regionController).length > 0) {
    mask |= WORLD_DELTA_MASK.regionController;
    compact.f = regionController;
  }
  if (Object.keys(hexOwner).length > 0) {
    mask |= WORLD_DELTA_MASK.hexOwner;
    compact.o = hexOwner;
  }
  if (Object.keys(hexNameById).length > 0) {
    mask |= WORLD_DELTA_MASK.hexNameById;
    compact.n = hexNameById;
  }
  if (Object.keys(colonyProgressByRegion).length > 0) {
    mask |= WORLD_DELTA_MASK.colonyProgressByRegion;
    compact.p = colonyProgressByRegion;
  }
  if (Object.keys(regionColonizationByRegion).length > 0) {
    mask |= WORLD_DELTA_MASK.regionColonizationByRegion;
    compact.z = regionColonizationByRegion;
  }
  if (Object.keys(regionPopulationByRegion).length > 0) {
    mask |= WORLD_DELTA_MASK.regionPopulationByRegion;
    compact.u = regionPopulationByRegion;
  }
  if (Object.keys(regionBuildingsByRegion).length > 0) {
    mask |= WORLD_DELTA_MASK.regionBuildingsByRegion;
    compact.b = regionBuildingsByRegion;
  }
  if (Object.keys(regionBuildingDucatsByRegion).length > 0) {
    mask |= WORLD_DELTA_MASK.regionBuildingDucatsByRegion;
    compact.q = regionBuildingDucatsByRegion;
  }
  if (Object.keys(regionPopulationTreasuryByRegion).length > 0) {
    mask |= WORLD_DELTA_MASK.regionPopulationTreasuryByRegion;
    compact.y = regionPopulationTreasuryByRegion;
  }
  if (Object.keys(regionConstructionQueueByRegion).length > 0) {
    mask |= WORLD_DELTA_MASK.regionConstructionQueueByRegion;
    compact.r = regionConstructionQueueByRegion;
  }
  if (Object.keys(regionResourceDepositsByRegion).length > 0) {
    mask |= WORLD_DELTA_MASK.regionResourceDepositsByRegion;
    compact.t = regionResourceDepositsByRegion;
  }
  if (Object.keys(regionResourceExplorationQueueByRegion).length > 0) {
    mask |= WORLD_DELTA_MASK.regionResourceExplorationQueueByRegion;
    compact.e = regionResourceExplorationQueueByRegion;
  }
  if (Object.keys(regionResourceExplorationCountByRegion).length > 0) {
    mask |= WORLD_DELTA_MASK.regionResourceExplorationCountByRegion;
    compact.k = regionResourceExplorationCountByRegion;
  }
  if (Object.keys(parliamentByCountry).length > 0) {
    mask |= WORLD_DELTA_MASK.parliamentByCountry;
    compact.m = parliamentByCountry;
  }
  if (Object.keys(technologyByCountry).length > 0) {
    mask |= WORLD_DELTA_MASK.technologyByCountry;
    compact.h = technologyByCountry;
  }
  if (Object.keys(countryDecisionsByCountryId).length > 0) {
    mask |= WORLD_DELTA_MASK.countryDecisionsByCountryId;
    compact.d = countryDecisionsByCountryId;
  }
  if (Object.keys(countryEventsByCountryId).length > 0) {
    mask |= WORLD_DELTA_MASK.countryEventsByCountryId;
    compact.v = countryEventsByCountryId;
  }
  if (Object.keys(countryScheduledEventsByCountryId).length > 0) {
    mask |= WORLD_DELTA_MASK.countryScheduledEventsByCountryId;
    compact.s = countryScheduledEventsByCountryId;
  }
  if (Object.keys(countryEventFlagsByCountryId).length > 0) {
    mask |= WORLD_DELTA_MASK.countryEventFlagsByCountryId;
    compact.xg = countryEventFlagsByCountryId;
  }
  if (Object.keys(journalEntriesByCountryId).length > 0) {
    mask |= WORLD_DELTA_MASK.journalEntriesByCountryId;
    compact.jo = journalEntriesByCountryId;
  }
  if (Object.keys(countryModifiersByCountryId).length > 0) {
    mask |= WORLD_DELTA_MASK.countryModifiersByCountryId;
    compact.cm = countryModifiersByCountryId;
  }
  if (Object.keys(divisionTemplatesByCountry).length > 0) {
    mask |= WORLD_DELTA_MASK.divisionTemplatesByCountry;
    compact.g = divisionTemplatesByCountry;
  }
  if (Object.keys(divisionsById).length > 0) {
    mask |= WORLD_DELTA_MASK.divisionsById;
    compact.x = divisionsById;
  }
  if (Object.keys(militaryFormationQueueByCountry).length > 0) {
    mask |= WORLD_DELTA_MASK.militaryFormationQueueByCountry;
    compact.w = militaryFormationQueueByCountry;
  }
  if (Object.keys(civilianUnitsById).length > 0) {
    mask |= WORLD_DELTA_MASK.unitEquipmentState;
    compact.cu = civilianUnitsById;
  }
  if (Object.keys(unitsById).length > 0) {
    mask |= WORLD_DELTA_MASK.unitEquipmentState;
    compact.mu = unitsById;
  }
  if (Object.keys(unitTrainingQueueByCountry).length > 0) {
    mask |= WORLD_DELTA_MASK.unitEquipmentState;
    compact.uq = unitTrainingQueueByCountry;
  }
  if (Object.keys(fleetsById).length > 0) {
    mask |= WORLD_DELTA_MASK.unitEquipmentState;
    compact.fl = fleetsById;
  }
  if (Object.keys(airWingsById).length > 0) {
    mask |= WORLD_DELTA_MASK.unitEquipmentState;
    compact.aw = airWingsById;
  }
  if (Object.keys(civilianUnitQueueByCountry).length > 0) {
    mask |= WORLD_DELTA_MASK.unitEquipmentState;
    compact.cq = civilianUnitQueueByCountry;
  }
  if (Object.keys(settlementProjectsById).length > 0) {
    mask |= WORLD_DELTA_MASK.unitEquipmentState;
    compact.sp = settlementProjectsById;
  }
  if (Object.keys(cityMarkersById).length > 0) {
    mask |= WORLD_DELTA_MASK.unitEquipmentState;
    compact.ci = cityMarkersById;
  }
  if (Object.keys(equipmentVariantsById).length > 0) {
    mask |= WORLD_DELTA_MASK.unitEquipmentState;
    compact.ev = equipmentVariantsById;
  }
  if (Object.keys(equipmentProductionLinesByCountry).length > 0) {
    mask |= WORLD_DELTA_MASK.unitEquipmentState;
    compact.el = equipmentProductionLinesByCountry;
  }
  if (Object.keys(equipmentStockpileByCountry).length > 0) {
    mask |= WORLD_DELTA_MASK.unitEquipmentState;
    compact.es = equipmentStockpileByCountry;
  }
  if (diplomacyProposalsChanged) {
    mask |= WORLD_DELTA_MASK.diplomacyProposals;
    compact.j = next.diplomacyProposals;
  }
  compact.mask = mask;
  return compact;
}

export function toWorldBaseForDeltaDiff(previous: WorldBaseSectionSnapshot, next: WorldBase): WorldBase {
  return {
    turnId: previous.turnId,
    resourcesByCountry:
      (previous.mask & WORLD_DELTA_MASK.resourcesByCountry) !== 0 && previous.resourcesByCountry
        ? previous.resourcesByCountry
        : next.resourcesByCountry,
    resourceLedgerByTurn:
      (previous.mask & WORLD_DELTA_MASK.resourceLedgerByTurn) !== 0 && previous.resourceLedgerByTurn
        ? previous.resourceLedgerByTurn
        : next.resourceLedgerByTurn,
    explanationRecordsByTurn:
      (previous.mask & WORLD_DELTA_MASK.explanationRecordsByTurn) !== 0 && previous.explanationRecordsByTurn
        ? previous.explanationRecordsByTurn
        : next.explanationRecordsByTurn,
    regionOwner:
      (previous.mask & WORLD_DELTA_MASK.regionOwner) !== 0 && previous.regionOwner
        ? previous.regionOwner
        : next.regionOwner,
    regionController:
      (previous.mask & WORLD_DELTA_MASK.regionController) !== 0 && previous.regionController
        ? previous.regionController
        : next.regionController,
    hexOwner:
      (previous.mask & WORLD_DELTA_MASK.hexOwner) !== 0 && previous.hexOwner
        ? previous.hexOwner
        : next.hexOwner,
    hexNameById:
      (previous.mask & WORLD_DELTA_MASK.hexNameById) !== 0 && previous.hexNameById
        ? previous.hexNameById
        : next.hexNameById,
    colonyProgressByRegion:
      (previous.mask & WORLD_DELTA_MASK.colonyProgressByRegion) !== 0 && previous.colonyProgressByRegion
        ? previous.colonyProgressByRegion
        : next.colonyProgressByRegion,
    regionColonizationByRegion:
      (previous.mask & WORLD_DELTA_MASK.regionColonizationByRegion) !== 0 && previous.regionColonizationByRegion
        ? previous.regionColonizationByRegion
        : next.regionColonizationByRegion,
    regionPopulationByRegion:
      (previous.mask & WORLD_DELTA_MASK.regionPopulationByRegion) !== 0 && previous.regionPopulationByRegion
        ? previous.regionPopulationByRegion
        : next.regionPopulationByRegion,
    regionBuildingsByRegion:
      (previous.mask & WORLD_DELTA_MASK.regionBuildingsByRegion) !== 0 && previous.regionBuildingsByRegion
        ? previous.regionBuildingsByRegion
        : next.regionBuildingsByRegion,
    regionBuildingDucatsByRegion:
      (previous.mask & WORLD_DELTA_MASK.regionBuildingDucatsByRegion) !== 0 && previous.regionBuildingDucatsByRegion
        ? previous.regionBuildingDucatsByRegion
        : next.regionBuildingDucatsByRegion,
    regionPopulationTreasuryByRegion:
      (previous.mask & WORLD_DELTA_MASK.regionPopulationTreasuryByRegion) !== 0 && previous.regionPopulationTreasuryByRegion
        ? previous.regionPopulationTreasuryByRegion
        : next.regionPopulationTreasuryByRegion,
    regionConstructionQueueByRegion:
      (previous.mask & WORLD_DELTA_MASK.regionConstructionQueueByRegion) !== 0 && previous.regionConstructionQueueByRegion
        ? previous.regionConstructionQueueByRegion
        : next.regionConstructionQueueByRegion,
    regionResourceDepositsByRegion:
      (previous.mask & WORLD_DELTA_MASK.regionResourceDepositsByRegion) !== 0 &&
      previous.regionResourceDepositsByRegion
        ? previous.regionResourceDepositsByRegion
        : next.regionResourceDepositsByRegion,
    regionResourceExplorationQueueByRegion:
      (previous.mask & WORLD_DELTA_MASK.regionResourceExplorationQueueByRegion) !== 0 &&
      previous.regionResourceExplorationQueueByRegion
        ? previous.regionResourceExplorationQueueByRegion
        : next.regionResourceExplorationQueueByRegion,
    regionResourceExplorationCountByRegion:
      (previous.mask & WORLD_DELTA_MASK.regionResourceExplorationCountByRegion) !== 0 &&
      previous.regionResourceExplorationCountByRegion
        ? previous.regionResourceExplorationCountByRegion
        : next.regionResourceExplorationCountByRegion,
    parliamentByCountry:
      (previous.mask & WORLD_DELTA_MASK.parliamentByCountry) !== 0 && previous.parliamentByCountry
        ? previous.parliamentByCountry
        : next.parliamentByCountry,
    technologyByCountry:
      (previous.mask & WORLD_DELTA_MASK.technologyByCountry) !== 0 && previous.technologyByCountry
        ? previous.technologyByCountry
        : next.technologyByCountry,
    countryDecisionsByCountryId:
      (previous.mask & WORLD_DELTA_MASK.countryDecisionsByCountryId) !== 0 && previous.countryDecisionsByCountryId
        ? previous.countryDecisionsByCountryId
        : next.countryDecisionsByCountryId,
    countryEventsByCountryId:
      (previous.mask & WORLD_DELTA_MASK.countryEventsByCountryId) !== 0 && previous.countryEventsByCountryId
        ? previous.countryEventsByCountryId
        : next.countryEventsByCountryId,
    countryScheduledEventsByCountryId:
      (previous.mask & WORLD_DELTA_MASK.countryScheduledEventsByCountryId) !== 0 && previous.countryScheduledEventsByCountryId
        ? previous.countryScheduledEventsByCountryId
        : next.countryScheduledEventsByCountryId,
    countryEventFlagsByCountryId:
      (previous.mask & WORLD_DELTA_MASK.countryEventFlagsByCountryId) !== 0 && previous.countryEventFlagsByCountryId
        ? previous.countryEventFlagsByCountryId
        : next.countryEventFlagsByCountryId,
    journalEntriesByCountryId:
      (previous.mask & WORLD_DELTA_MASK.journalEntriesByCountryId) !== 0 && previous.journalEntriesByCountryId
        ? previous.journalEntriesByCountryId
        : next.journalEntriesByCountryId,
    countryModifiersByCountryId:
      (previous.mask & WORLD_DELTA_MASK.countryModifiersByCountryId) !== 0 && previous.countryModifiersByCountryId
        ? previous.countryModifiersByCountryId
        : next.countryModifiersByCountryId,
    unitsById:
      (previous.mask & WORLD_DELTA_MASK.unitEquipmentState) !== 0 && previous.unitsById
        ? previous.unitsById
        : next.unitsById ?? {},
    unitTrainingQueueByCountry:
      (previous.mask & WORLD_DELTA_MASK.unitEquipmentState) !== 0 && previous.unitTrainingQueueByCountry
        ? previous.unitTrainingQueueByCountry
        : next.unitTrainingQueueByCountry ?? {},
    divisionTemplatesByCountry:
      (previous.mask & WORLD_DELTA_MASK.divisionTemplatesByCountry) !== 0 && previous.divisionTemplatesByCountry
        ? previous.divisionTemplatesByCountry
        : next.divisionTemplatesByCountry,
    divisionsById:
      (previous.mask & WORLD_DELTA_MASK.divisionsById) !== 0 && previous.divisionsById
        ? previous.divisionsById
        : next.divisionsById,
    militaryFormationQueueByCountry:
      (previous.mask & WORLD_DELTA_MASK.militaryFormationQueueByCountry) !== 0 && previous.militaryFormationQueueByCountry
        ? previous.militaryFormationQueueByCountry
        : next.militaryFormationQueueByCountry,
    fleetsById:
      (previous.mask & WORLD_DELTA_MASK.unitEquipmentState) !== 0 && previous.fleetsById
        ? previous.fleetsById
        : next.fleetsById,
    airWingsById:
      (previous.mask & WORLD_DELTA_MASK.unitEquipmentState) !== 0 && previous.airWingsById
        ? previous.airWingsById
        : next.airWingsById,
    civilianUnitsById:
      (previous.mask & WORLD_DELTA_MASK.unitEquipmentState) !== 0 && previous.civilianUnitsById
        ? previous.civilianUnitsById
        : next.civilianUnitsById,
    civilianUnitQueueByCountry:
      (previous.mask & WORLD_DELTA_MASK.unitEquipmentState) !== 0 && previous.civilianUnitQueueByCountry
        ? previous.civilianUnitQueueByCountry
        : next.civilianUnitQueueByCountry,
    settlementProjectsById:
      (previous.mask & WORLD_DELTA_MASK.unitEquipmentState) !== 0 && previous.settlementProjectsById
        ? previous.settlementProjectsById
        : next.settlementProjectsById,
    cityMarkersById:
      (previous.mask & WORLD_DELTA_MASK.unitEquipmentState) !== 0 && previous.cityMarkersById
        ? previous.cityMarkersById
        : next.cityMarkersById,
    equipmentVariantsById:
      (previous.mask & WORLD_DELTA_MASK.unitEquipmentState) !== 0 && previous.equipmentVariantsById
        ? previous.equipmentVariantsById
        : next.equipmentVariantsById,
    equipmentProductionLinesByCountry:
      (previous.mask & WORLD_DELTA_MASK.unitEquipmentState) !== 0 && previous.equipmentProductionLinesByCountry
        ? previous.equipmentProductionLinesByCountry
        : next.equipmentProductionLinesByCountry,
    equipmentStockpileByCountry:
      (previous.mask & WORLD_DELTA_MASK.unitEquipmentState) !== 0 && previous.equipmentStockpileByCountry
        ? previous.equipmentStockpileByCountry
        : next.equipmentStockpileByCountry,
    diplomacyProposals:
      (previous.mask & WORLD_DELTA_MASK.diplomacyProposals) !== 0 && previous.diplomacyProposals
        ? previous.diplomacyProposals
        : next.diplomacyProposals,
  };
}

function collectRecordDiff<T>(
  prev: Record<string, T>,
  next: Record<string, T>,
  output: Record<string, T | null>,
): void {
  for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    const prevValue = prev[key];
    const nextValue = next[key];
    if (!nextValue) {
      output[key] = null;
      continue;
    }
    if (!isJsonEquivalent(prevValue ?? null, nextValue)) {
      output[key] = nextValue;
    }
  }
}

function isJsonEquivalent(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left == null || right == null) return left === right;
  if (typeof left !== typeof right) return false;
  if (typeof left !== "object") return Object.is(left, right);

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!isJsonEquivalent(normalizeJsonArrayValue(left[index]), normalizeJsonArrayValue(right[index]))) return false;
    }
    return true;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).filter((key) => leftRecord[key] !== undefined);
  const rightKeys = Object.keys(rightRecord).filter((key) => rightRecord[key] !== undefined);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(rightRecord, key)) return false;
    if (!isJsonEquivalent(leftRecord[key], rightRecord[key])) return false;
  }
  return true;
}

function normalizeJsonArrayValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

export function isEqualCountryProgressMap(
  prevValue: Record<string, number> | undefined,
  nextValue: Record<string, number>,
): boolean {
  if (!prevValue) {
    return false;
  }
  const prevKeys = Object.keys(prevValue);
  const nextKeys = Object.keys(nextValue);
  if (prevKeys.length !== nextKeys.length) {
    return false;
  }
  for (const key of nextKeys) {
    if ((prevValue[key] ?? Number.NaN) !== nextValue[key]) {
      return false;
    }
  }
  return true;
}

export function isEqualConstructionQueue(
  prevValue: RegionConstructionProject[] | undefined,
  nextValue: RegionConstructionProject[],
): boolean {
  if (!prevValue) return false;
  if (prevValue.length !== nextValue.length) return false;
  for (let i = 0; i < nextValue.length; i += 1) {
    const prev = prevValue[i];
    const next = nextValue[i];
    if (!prev || !next) return false;
    if (
      prev.queueId !== next.queueId ||
      prev.requestedByCountryId !== next.requestedByCountryId ||
      prev.buildingId !== next.buildingId ||
      prev.owner.type !== next.owner.type ||
      (prev.owner.type === "state" && next.owner.type === "state" && prev.owner.countryId !== next.owner.countryId) ||
      (prev.owner.type === "company" && next.owner.type === "company" && prev.owner.companyId !== next.owner.companyId) ||
      (prev.projectType ?? "build") !== (next.projectType ?? "build") ||
      (prev.targetInstanceId ?? "") !== (next.targetInstanceId ?? "") ||
      (prev.targetHexId ?? "") !== (next.targetHexId ?? "") ||
      prev.progressConstruction !== next.progressConstruction ||
      prev.costConstruction !== next.costConstruction ||
      prev.costDucats !== next.costDucats ||
      prev.createdTurnId !== next.createdTurnId
    ) {
      return false;
    }
  }
  return true;
}

export function isEqualResourceDeposits(
  prevValue: RegionResourceDeposit[] | undefined,
  nextValue: RegionResourceDeposit[],
): boolean {
  if (!prevValue) return false;
  if (prevValue.length !== nextValue.length) return false;
  for (let i = 0; i < nextValue.length; i += 1) {
    const prev = prevValue[i];
    const next = nextValue[i];
    if (!prev || !next) return false;
    if (
      prev.id !== next.id ||
      prev.goodId !== next.goodId ||
      prev.hexId !== next.hexId ||
      prev.regionId !== next.regionId ||
      Number(prev.amount) !== Number(next.amount) ||
      Number(prev.maxAmount) !== Number(next.maxAmount) ||
      Number(prev.initialAmount) !== Number(next.initialAmount) ||
      prev.visibility !== next.visibility ||
      prev.source !== next.source ||
      prev.depletionMode !== next.depletionMode ||
      Number(prev.regenPerTurn ?? 0) !== Number(next.regenPerTurn ?? 0) ||
      Number(prev.minRenewableAmount ?? 0) !== Number(next.minRenewableAmount ?? 0) ||
      prev.discoveredTurnId !== next.discoveredTurnId ||
      (prev.discoveredByCountryId ?? null) !== (next.discoveredByCountryId ?? null) ||
      (prev.sourceGeneratorId ?? null) !== (next.sourceGeneratorId ?? null)
    ) {
      return false;
    }
  }
  return true;
}

export function isEqualResourceExplorationQueue(
  prevValue: RegionResourceExplorationProject[] | undefined,
  nextValue: RegionResourceExplorationProject[],
): boolean {
  if (!prevValue) return false;
  if (prevValue.length !== nextValue.length) return false;
  for (let i = 0; i < nextValue.length; i += 1) {
    const prev = prevValue[i];
    const next = nextValue[i];
    if (!prev || !next) return false;
    if (
      prev.queueId !== next.queueId ||
      prev.requestedByCountryId !== next.requestedByCountryId ||
      prev.startedTurnId !== next.startedTurnId ||
      prev.turnsRemaining !== next.turnsRemaining
    ) {
      return false;
    }
  }
  return true;
}

export function isEqualBuildingInstances(
  prevValue: BuildingInstance[] | undefined,
  nextValue: BuildingInstance[],
): boolean {
  if (!prevValue) return false;
  if (prevValue.length !== nextValue.length) return false;
  for (let i = 0; i < nextValue.length; i += 1) {
    const prev = prevValue[i];
    const next = nextValue[i];
    if (!prev || !next) return false;
    if (
      prev.instanceId !== next.instanceId ||
      prev.buildingId !== next.buildingId ||
      (prev.targetHexId ?? "") !== (next.targetHexId ?? "") ||
      (typeof prev.customName === "string" ? prev.customName : null) !==
        (typeof next.customName === "string" ? next.customName : null) ||
      prev.createdTurnId !== next.createdTurnId ||
      Math.max(1, Math.floor(Number(prev.level ?? 1))) !== Math.max(1, Math.floor(Number(next.level ?? 1))) ||
      (prev.autoUpgradeEnabled !== false) !== (next.autoUpgradeEnabled !== false) ||
      (prev.stateSubsidiesEnabled !== false) !== (next.stateSubsidiesEnabled !== false) ||
      (prev.manualWorkEnabled !== false) !== (next.manualWorkEnabled !== false) ||
      prev.owner.type !== next.owner.type ||
      (prev.owner.type === "state" && next.owner.type === "state" && prev.owner.countryId !== next.owner.countryId) ||
      (prev.owner.type === "company" &&
        next.owner.type === "company" &&
        prev.owner.companyId !== next.owner.companyId)
    ) {
      return false;
    }
    if (
      Number(prev.ducats ?? 0) !== Number(next.ducats ?? 0) ||
      Number(prev.currentDurability ?? 0) !== Number(next.currentDurability ?? 0) ||
      Number(prev.lastLaborCoverage ?? 0) !== Number(next.lastLaborCoverage ?? 0) ||
      Number(prev.lastInfraCoverage ?? 0) !== Number(next.lastInfraCoverage ?? 0) ||
      Number(prev.lastInputCoverage ?? 0) !== Number(next.lastInputCoverage ?? 0) ||
      Number(prev.lastFinanceCoverage ?? 0) !== Number(next.lastFinanceCoverage ?? 0) ||
      Number(prev.lastExtractionCoverage ?? 0) !== Number(next.lastExtractionCoverage ?? 0) ||
      Number(prev.lastDurabilityCoverage ?? 0) !== Number(next.lastDurabilityCoverage ?? 0) ||
      Number(prev.lastProductivity ?? 0) !== Number(next.lastProductivity ?? 0) ||
      Number(prev.lastRevenueDucats ?? 0) !== Number(next.lastRevenueDucats ?? 0) ||
      Number(prev.lastInputCostDucats ?? 0) !== Number(next.lastInputCostDucats ?? 0) ||
      Number(prev.lastWagesDucats ?? 0) !== Number(next.lastWagesDucats ?? 0) ||
      Number(prev.lastStateSubsidyDucats ?? 0) !== Number(next.lastStateSubsidyDucats ?? 0) ||
      Number(prev.lastNetDucats ?? 0) !== Number(next.lastNetDucats ?? 0) ||
      Boolean(prev.isInactive) !== Boolean(next.isInactive) ||
      (prev.inactiveReason ?? null) !== (next.inactiveReason ?? null)
    ) {
      return false;
    }
    if (!isEqualCountryProgressMap(prev.warehouseByGoodId, next.warehouseByGoodId ?? {})) return false;
    if (!isEqualCountryProgressMap(prev.lastPurchaseByGoodId, next.lastPurchaseByGoodId ?? {})) return false;
    if (!isEqualCountryProgressMap(prev.lastPurchaseCostByGoodId, next.lastPurchaseCostByGoodId ?? {})) return false;
    if (!isEqualCountryProgressMap(prev.lastSalesByGoodId, next.lastSalesByGoodId ?? {})) return false;
    if (!isEqualCountryProgressMap(prev.lastSalesRevenueByGoodId, next.lastSalesRevenueByGoodId ?? {})) return false;
    if (!isEqualCountryProgressMap(prev.lastConsumptionByGoodId, next.lastConsumptionByGoodId ?? {})) return false;
    if (!isEqualCountryProgressMap(prev.lastProductionByGoodId, next.lastProductionByGoodId ?? {})) return false;
    if (!isEqualCountryProgressMap(prev.lastExtractionByGoodId, next.lastExtractionByGoodId ?? {})) return false;
  }
  return true;
}
