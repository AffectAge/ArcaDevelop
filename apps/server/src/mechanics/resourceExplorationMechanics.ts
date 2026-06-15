import type { RegionResourceDeposit, RegionResourceExplorationProject, WorldBase } from "@arcanorum/shared";

export const DEFAULT_EXPLORATION_EMPTY_CHANCE_PCT = 5;
export const DEFAULT_EXPLORATION_DEPLETION_PER_ATTEMPT_PCT = 7.5;
export const DEFAULT_EXPLORATION_DURATION_TURNS = 1;
export const DEFAULT_EXPLORATION_ROLLS_PER_EXPEDITION = 3;

export type ResourceExplorationVeinSize = "small" | "medium" | "large";

export type ResourceExplorationGood = {
  id: string;
  isResourceDiscoverable?: boolean | null;
  explorationBaseWeight?: number | null;
  explorationSmallVeinChancePct?: number | null;
  explorationMediumVeinChancePct?: number | null;
  explorationLargeVeinChancePct?: number | null;
  explorationSmallVeinMin?: number | null;
  explorationSmallVeinMax?: number | null;
  explorationMediumVeinMin?: number | null;
  explorationMediumVeinMax?: number | null;
  explorationLargeVeinMin?: number | null;
  explorationLargeVeinMax?: number | null;
};

export type ResourceExplorationRegion = {
  id: string;
  areaKm2?: number | null;
};

export type ResourceExplorationConfig = {
  rollsPerExpedition: number;
  baseEmptyChancePct: number;
  depletionPerAttemptPct: number;
};

export type ResourceExplorationWorldState = Pick<
  WorldBase,
  | "regionOwner"
  | "regionController"
  | "regionResourceExplorationQueueByRegion"
  | "regionResourceExplorationCountByRegion"
  | "regionResourceDepositsByRegion"
>;

export function normalizeExplorationDurationTurns(input: unknown): number {
  return Math.max(1, Math.floor(Number(input ?? DEFAULT_EXPLORATION_DURATION_TURNS)));
}

export function normalizeResourceExplorationConfig(input: Partial<ResourceExplorationConfig>): ResourceExplorationConfig {
  return {
    rollsPerExpedition: Math.max(
      1,
      Math.floor(Number(input.rollsPerExpedition ?? DEFAULT_EXPLORATION_ROLLS_PER_EXPEDITION)),
    ),
    baseEmptyChancePct: Math.max(
      0,
      Math.min(100, Number(input.baseEmptyChancePct ?? DEFAULT_EXPLORATION_EMPTY_CHANCE_PCT)),
    ),
    depletionPerAttemptPct: Math.max(
      0,
      Math.min(100, Number(input.depletionPerAttemptPct ?? DEFAULT_EXPLORATION_DEPLETION_PER_ATTEMPT_PCT)),
    ),
  };
}

export function createResourceExplorationProject(params: {
  queueId: string;
  requestedByCountryId: string;
  startedTurnId: number;
  durationTurns: number;
}): RegionResourceExplorationProject {
  return {
    queueId: params.queueId,
    requestedByCountryId: params.requestedByCountryId,
    startedTurnId: params.startedTurnId,
    turnsRemaining: normalizeExplorationDurationTurns(params.durationTurns),
  };
}

export function rollExplorationNumberInRange(params: {
  minValue: number;
  maxValue: number;
  random?: () => number;
}): number {
  const random = params.random ?? Math.random;
  const min = Math.max(0, Number.isFinite(params.minValue) ? params.minValue : 0);
  const max = Math.max(min, Number.isFinite(params.maxValue) ? params.maxValue : min);
  const value = min + random() * (max - min);
  return round3(value);
}

export function rollWeightedExplorationChoice<T>(
  items: Array<{ weight: number; value: T }>,
  random: () => number = Math.random,
): T | null {
  const prepared = items
    .map((item) => ({ ...item, weight: Math.max(0, Number(item.weight)) }))
    .filter((item) => item.weight > 0);
  if (prepared.length === 0) return null;
  const total = prepared.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return null;
  let pivot = random() * total;
  for (const item of prepared) {
    pivot -= item.weight;
    if (pivot <= 0) return item.value;
  }
  return prepared[prepared.length - 1]?.value ?? null;
}

export function resolveResourceExplorationTurn(params: {
  worldBase: ResourceExplorationWorldState;
  regions: ResourceExplorationRegion[];
  goods: ResourceExplorationGood[];
  turnId: number;
  config: Partial<ResourceExplorationConfig>;
  random?: () => number;
}): void {
  const discoverableGoods = params.goods.filter((good) => Boolean(good.isResourceDiscoverable));
  if (discoverableGoods.length === 0) return;

  const random = params.random ?? Math.random;
  const config = normalizeResourceExplorationConfig(params.config);

  for (const region of params.regions) {
    const regionId = region.id;
    const ownerCountryId = params.worldBase.regionController[regionId] ?? params.worldBase.regionOwner[regionId] ?? null;
    const queue = [...(params.worldBase.regionResourceExplorationQueueByRegion[regionId] ?? [])];
    if (queue.length === 0) continue;
    const nextQueue: RegionResourceExplorationProject[] = [];
    let explorationCount = Math.max(0, Math.floor(params.worldBase.regionResourceExplorationCountByRegion[regionId] ?? 0));
    const deposits = [...(params.worldBase.regionResourceDepositsByRegion[regionId] ?? [])];

    for (const project of queue) {
      if (!ownerCountryId || project.requestedByCountryId !== ownerCountryId) {
        continue;
      }
      const nextTurnsRemaining = Math.max(0, Math.floor(project.turnsRemaining) - 1);
      if (nextTurnsRemaining > 0) {
        nextQueue.push({ ...project, turnsRemaining: nextTurnsRemaining });
        continue;
      }
      const found = resolveCompletedExplorationProject({
        regionId,
        regionAreaKm2: region.areaKm2 ?? 1_000,
        goods: discoverableGoods,
        explorationCount,
        turnId: params.turnId,
        config,
        random,
      });
      mergeResourceDeposits(deposits, found);
      explorationCount += 1;
    }

    params.worldBase.regionResourceExplorationQueueByRegion[regionId] = nextQueue;
    params.worldBase.regionResourceExplorationCountByRegion[regionId] = explorationCount;
    params.worldBase.regionResourceDepositsByRegion[regionId] = deposits.sort((a, b) => a.goodId.localeCompare(b.goodId));
    if (params.worldBase.regionResourceExplorationQueueByRegion[regionId].length === 0) {
      params.worldBase.regionResourceExplorationQueueByRegion[regionId] = [];
    }
  }
}

export function resolveCompletedExplorationProject(params: {
  regionId: string;
  regionAreaKm2: number;
  goods: ResourceExplorationGood[];
  explorationCount: number;
  turnId: number;
  config: ResourceExplorationConfig;
  random?: () => number;
}): RegionResourceDeposit[] {
  const random = params.random ?? Math.random;
  const emptyChancePct = Math.max(
    0,
    Math.min(99.9, params.config.baseEmptyChancePct + params.explorationCount * params.config.depletionPerAttemptPct),
  );
  const areaFactor = Math.max(0.001, Math.max(1, Number(params.regionAreaKm2) || 1_000) / 1000);
  const foundByGoodId = new Map<string, { amount: number; veinSize: ResourceExplorationVeinSize }>();

  for (let roll = 0; roll < params.config.rollsPerExpedition; roll += 1) {
    if (random() * 100 < emptyChancePct) continue;
    const chosenGoodId = rollWeightedExplorationChoice(
      params.goods.map((good) => ({
        weight: Math.max(0, Number(good.explorationBaseWeight ?? 0)) * areaFactor,
        value: good.id,
      })),
      random,
    );
    if (!chosenGoodId) continue;
    const good = params.goods.find((entry) => entry.id === chosenGoodId);
    if (!good) continue;
    const chosenVeinSize = chooseExplorationVeinSize(good, random);
    const amount = rollExplorationVeinAmount(good, chosenVeinSize, random);
    if (amount <= 0) continue;
    const prev = foundByGoodId.get(chosenGoodId);
    foundByGoodId.set(chosenGoodId, {
      amount: round3((prev?.amount ?? 0) + amount),
      veinSize: prev?.veinSize ?? chosenVeinSize,
    });
  }

  return [...foundByGoodId.entries()].map(([goodId, found]) => ({
    goodId,
    amount: round3(found.amount),
    discoveredTurnId: params.turnId,
    veinSize: found.veinSize,
  }));
}

export function chooseExplorationVeinSize(
  good: ResourceExplorationGood,
  random: () => number = Math.random,
): ResourceExplorationVeinSize {
  const smallChance = Math.max(0, Number(good.explorationSmallVeinChancePct ?? 60));
  const mediumChance = Math.max(0, Number(good.explorationMediumVeinChancePct ?? 30));
  const largeChance = Math.max(0, Number(good.explorationLargeVeinChancePct ?? 10));
  return (
    rollWeightedExplorationChoice<ResourceExplorationVeinSize>(
      [
        { weight: smallChance, value: "small" },
        { weight: mediumChance, value: "medium" },
        { weight: largeChance, value: "large" },
      ],
      random,
    ) ?? "small"
  );
}

export function rollExplorationVeinAmount(
  good: ResourceExplorationGood,
  veinSize: ResourceExplorationVeinSize,
  random: () => number = Math.random,
): number {
  if (veinSize === "small") {
    return rollExplorationNumberInRange({
      minValue: Number(good.explorationSmallVeinMin ?? 10),
      maxValue: Number(good.explorationSmallVeinMax ?? 100),
      random,
    });
  }
  if (veinSize === "medium") {
    return rollExplorationNumberInRange({
      minValue: Number(good.explorationMediumVeinMin ?? 100),
      maxValue: Number(good.explorationMediumVeinMax ?? 500),
      random,
    });
  }
  return rollExplorationNumberInRange({
    minValue: Number(good.explorationLargeVeinMin ?? 500),
    maxValue: Number(good.explorationLargeVeinMax ?? 2000),
    random,
  });
}

export function mergeResourceDeposits(target: RegionResourceDeposit[], found: RegionResourceDeposit[]): void {
  for (const row of found) {
    const existing = target.find((entry) => entry.goodId === row.goodId);
    if (existing) {
      existing.amount = round3(existing.amount + row.amount);
      continue;
    }
    target.push({ ...row, amount: round3(row.amount) });
  }
}

function round3(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}
