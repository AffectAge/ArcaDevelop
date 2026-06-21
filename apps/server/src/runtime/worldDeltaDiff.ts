import type {
  BuildingInstance,
  Division,
  DivisionTemplate,
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

export type CompactWorldDeltaPayload = Omit<WorldDelta, "type" | "turnId" | "worldStateVersion" | "rejectedOrders">;

export type BaselineWorldDeltaPayload = {
  type: "WORLD_DELTA";
  turnId: number;
  worldStateVersion: number;
  changes: {
    resourcesByCountry?: WorldDelta["c"];
    resourceLedgerByTurn?: WorldDelta["l"];
    regionOwner?: WorldDelta["a"];
    regionController?: WorldDelta["f"];
    provinceOwner?: WorldDelta["o"];
    provinceNameById?: WorldDelta["n"];
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
    divisionTemplatesByCountry?: WorldDelta["g"];
    divisionsById?: WorldDelta["x"];
    militaryFormationQueueByCountry?: WorldDelta["w"];
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
    g: params.compact.g,
    x: params.compact.x,
    w: params.compact.w,
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
      regionOwner: params.compact.a,
      regionController: params.compact.f,
      provinceOwner: params.compact.o,
      provinceNameById: params.compact.n,
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
      divisionTemplatesByCountry: params.compact.g,
      divisionsById: params.compact.x,
      militaryFormationQueueByCountry: params.compact.w,
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
  regionOwner?: WorldBase["regionOwner"];
  regionController?: WorldBase["regionController"];
  provinceOwner?: WorldBase["provinceOwner"];
  provinceNameById?: WorldBase["provinceNameById"];
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
  divisionTemplatesByCountry?: WorldBase["divisionTemplatesByCountry"];
  divisionsById?: WorldBase["divisionsById"];
  militaryFormationQueueByCountry?: WorldBase["militaryFormationQueueByCountry"];
  diplomacyProposals?: WorldBase["diplomacyProposals"];
};

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
  if ((mask & WORLD_DELTA_MASK.regionOwner) !== 0) {
    snapshot.regionOwner = { ...worldBase.regionOwner };
  }
  if ((mask & WORLD_DELTA_MASK.regionController) !== 0) {
    snapshot.regionController = { ...worldBase.regionController };
  }
  if ((mask & WORLD_DELTA_MASK.provinceOwner) !== 0) {
    snapshot.provinceOwner = { ...worldBase.provinceOwner };
  }
  if ((mask & WORLD_DELTA_MASK.provinceNameById) !== 0) {
    snapshot.provinceNameById = { ...worldBase.provinceNameById };
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
  if ((mask & WORLD_DELTA_MASK.divisionTemplatesByCountry) !== 0) {
    snapshot.divisionTemplatesByCountry = structuredClone(worldBase.divisionTemplatesByCountry);
  }
  if ((mask & WORLD_DELTA_MASK.divisionsById) !== 0) {
    snapshot.divisionsById = structuredClone(worldBase.divisionsById);
  }
  if ((mask & WORLD_DELTA_MASK.militaryFormationQueueByCountry) !== 0) {
    snapshot.militaryFormationQueueByCountry = structuredClone(worldBase.militaryFormationQueueByCountry);
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
      baselinePayload: BaselineWorldDeltaPayload;
    };

export function prepareWorldDeltaBroadcast(params: {
  previous: WorldBaseSectionSnapshot;
  next: WorldBase;
  turnId: number;
  currentWorldStateVersion: number;
  rejectedOrders: WorldDelta["rejectedOrders"];
  isEqualRegionPopulation: (prevValue: RegionPopulation | undefined, nextValue: RegionPopulation) => boolean;
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
  return {
    ok: true,
    nextWorldStateVersion,
    payload: buildWorldDeltaPayload({
      turnId: params.turnId,
      worldStateVersion: nextWorldStateVersion,
      compact,
      rejectedOrders: params.rejectedOrders,
    }),
    baselinePayload: buildBaselineWorldDeltaPayload({
      turnId: params.turnId,
      worldStateVersion: nextWorldStateVersion,
      compact,
      rejectedOrders: params.rejectedOrders,
    }),
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
  const regionOwner: Record<string, string | null> = {};
  const regionController: Record<string, string | null> = {};
  const provinceOwner: Record<string, string | null> = {};
  const provinceNameById: Record<string, string | null> = {};
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
  const divisionTemplatesByCountry: Record<string, DivisionTemplate[] | null> = {};
  const divisionsById: Record<string, Division | null> = {};
  const militaryFormationQueueByCountry: Record<string, MilitaryFormationQueueItem[] | null> = {};
  const diplomacyProposalsChanged = JSON.stringify(prev.diplomacyProposals ?? []) !== JSON.stringify(next.diplomacyProposals ?? []);

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
    if (JSON.stringify(prevValue ?? null) !== JSON.stringify(nextValue)) {
      resourceLedgerByTurn[turnId] = nextValue;
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

  for (const key of new Set([...Object.keys(prev.provinceOwner), ...Object.keys(next.provinceOwner)])) {
    const prevValue = prev.provinceOwner[key];
    const nextValue = next.provinceOwner[key];
    if (typeof nextValue !== "string") {
      provinceOwner[key] = null;
      continue;
    }
    if (prevValue !== nextValue) {
      provinceOwner[key] = nextValue;
    }
  }

  for (const key of new Set([...Object.keys(prev.provinceNameById), ...Object.keys(next.provinceNameById)])) {
    const prevValue = prev.provinceNameById[key];
    const nextValue = next.provinceNameById[key];
    if (typeof nextValue !== "string") {
      provinceNameById[key] = null;
      continue;
    }
    if (prevValue !== nextValue) {
      provinceNameById[key] = nextValue;
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
    if (JSON.stringify(prevValue ?? null) !== JSON.stringify(nextValue)) {
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
    if (JSON.stringify(prevValue ?? null) !== JSON.stringify(nextValue)) {
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
    if (JSON.stringify(prevValue ?? null) !== JSON.stringify(nextValue)) {
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
    if (JSON.stringify(prevValue ?? null) !== JSON.stringify(nextValue)) {
      countryEventsByCountryId[key] = nextValue;
    }
  }
  for (const key of new Set([...Object.keys(prev.divisionTemplatesByCountry), ...Object.keys(next.divisionTemplatesByCountry)])) {
    const prevValue = prev.divisionTemplatesByCountry[key];
    const nextValue = next.divisionTemplatesByCountry[key];
    if (!nextValue) {
      divisionTemplatesByCountry[key] = null;
      continue;
    }
    if (JSON.stringify(prevValue ?? null) !== JSON.stringify(nextValue)) {
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
    if (JSON.stringify(prevValue ?? null) !== JSON.stringify(nextValue)) {
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
    if (JSON.stringify(prevValue ?? null) !== JSON.stringify(nextValue)) {
      militaryFormationQueueByCountry[key] = nextValue;
    }
  }

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
  if (Object.keys(regionOwner).length > 0) {
    mask |= WORLD_DELTA_MASK.regionOwner;
    compact.a = regionOwner;
  }
  if (Object.keys(regionController).length > 0) {
    mask |= WORLD_DELTA_MASK.regionController;
    compact.f = regionController;
  }
  if (Object.keys(provinceOwner).length > 0) {
    mask |= WORLD_DELTA_MASK.provinceOwner;
    compact.o = provinceOwner;
  }
  if (Object.keys(provinceNameById).length > 0) {
    mask |= WORLD_DELTA_MASK.provinceNameById;
    compact.n = provinceNameById;
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
    regionOwner:
      (previous.mask & WORLD_DELTA_MASK.regionOwner) !== 0 && previous.regionOwner
        ? previous.regionOwner
        : next.regionOwner,
    regionController:
      (previous.mask & WORLD_DELTA_MASK.regionController) !== 0 && previous.regionController
        ? previous.regionController
        : next.regionController,
    provinceOwner:
      (previous.mask & WORLD_DELTA_MASK.provinceOwner) !== 0 && previous.provinceOwner
        ? previous.provinceOwner
        : next.provinceOwner,
    provinceNameById:
      (previous.mask & WORLD_DELTA_MASK.provinceNameById) !== 0 && previous.provinceNameById
        ? previous.provinceNameById
        : next.provinceNameById,
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
    diplomacyProposals:
      (previous.mask & WORLD_DELTA_MASK.diplomacyProposals) !== 0 && previous.diplomacyProposals
        ? previous.diplomacyProposals
        : next.diplomacyProposals,
  };
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
      prev.goodId !== next.goodId ||
      Number(prev.amount) !== Number(next.amount) ||
      prev.discoveredTurnId !== next.discoveredTurnId ||
      prev.veinSize !== next.veinSize
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
