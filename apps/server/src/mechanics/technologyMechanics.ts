import type { CountryTechnologyState, ResourceTotals, WorldBase } from "@arcanorum/shared";

export type TechnologyContentEntry = {
  id: string;
  name?: string;
  costScience?: number | null;
  prerequisiteTechnologyIds?: string[];
  unlockBuildingIds?: string[];
  unlockLawIds?: string[];
};

export type TechnologyWorldState = Pick<WorldBase, "resourcesByCountry" | "technologyByCountry">;

export type TechnologyCompletion = {
  countryId: string;
  technologyId: string;
  technologyName: string;
};

export function getTechnologyById(technologies: TechnologyContentEntry[]): Map<string, TechnologyContentEntry> {
  return new Map(technologies.map((entry) => [entry.id, entry] as const));
}

export function getUnlockingTechnologyForBuilding(
  buildingId: string,
  technologies: TechnologyContentEntry[],
): TechnologyContentEntry | null {
  return technologies.find((entry) => normalizeIdList(entry.unlockBuildingIds).includes(buildingId)) ?? null;
}

export function getUnlockingTechnologyForLaw(
  lawId: string,
  technologies: TechnologyContentEntry[],
): TechnologyContentEntry | null {
  return technologies.find((entry) => normalizeIdList(entry.unlockLawIds).includes(lawId)) ?? null;
}

export function isTechnologyResearched(state: CountryTechnologyState, technologyId: string): boolean {
  return normalizeIdList(state.researchedTechnologyIds).includes(technologyId);
}

export function isTechnologyAvailableForCountry(
  state: CountryTechnologyState,
  technology: TechnologyContentEntry,
): boolean {
  if (isTechnologyResearched(state, technology.id)) return false;
  const researched = new Set(normalizeIdList(state.researchedTechnologyIds));
  return normalizeIdList(technology.prerequisiteTechnologyIds).every((technologyId) => researched.has(technologyId));
}

export function isBuildingUnlockedForCountry(params: {
  buildingId: string;
  state: CountryTechnologyState;
  technologies: TechnologyContentEntry[];
}): boolean {
  const requiredTechnology = getUnlockingTechnologyForBuilding(params.buildingId, params.technologies);
  return !requiredTechnology || isTechnologyResearched(params.state, requiredTechnology.id);
}

export function isLawUnlockedForCountry(params: {
  lawId: string;
  state: CountryTechnologyState;
  technologies: TechnologyContentEntry[];
}): boolean {
  const requiredTechnology = getUnlockingTechnologyForLaw(params.lawId, params.technologies);
  return !requiredTechnology || isTechnologyResearched(params.state, requiredTechnology.id);
}

export function setActiveTechnologyState(params: {
  state: CountryTechnologyState;
  technologyId: string | null;
  active?: boolean;
  technologies: TechnologyContentEntry[];
}): { ok: true; state: CountryTechnologyState } | { ok: false; error: "TECHNOLOGY_NOT_FOUND" | "TECHNOLOGY_NOT_AVAILABLE" } {
  const state = params.state;
  if (!params.technologyId) {
    state.activeTechnologyId = null;
    state.activeTechnologyIds = [];
    return { ok: true, state };
  }

  const technology = params.technologies.find((entry) => entry.id === params.technologyId);
  if (!technology) {
    return { ok: false, error: "TECHNOLOGY_NOT_FOUND" };
  }

  if (params.active === false) {
    state.activeTechnologyIds = normalizeIdList(state.activeTechnologyIds).filter((technologyId) => technologyId !== technology.id);
    state.activeTechnologyId = state.activeTechnologyIds[0] ?? null;
    return { ok: true, state };
  }

  if (!isTechnologyAvailableForCountry(state, technology)) {
    return { ok: false, error: "TECHNOLOGY_NOT_AVAILABLE" };
  }

  state.activeTechnologyIds = normalizeIdList([...state.activeTechnologyIds, technology.id]);
  state.activeTechnologyId = state.activeTechnologyIds[0] ?? null;
  return { ok: true, state };
}

export function resolveTechnologyTurn(params: {
  worldBase: TechnologyWorldState;
  technologies: TechnologyContentEntry[];
  ensureCountryTechnologyState: (countryId: string) => CountryTechnologyState;
  resolveTechnologyCost: (countryId: string, technology: TechnologyContentEntry) => number;
}): TechnologyCompletion[] {
  const technologyById = getTechnologyById(params.technologies);
  const completions: TechnologyCompletion[] = [];

  for (const countryId of Object.keys(params.worldBase.resourcesByCountry)) {
    const resources = params.worldBase.resourcesByCountry[countryId];
    const state = params.ensureCountryTechnologyState(countryId);
    state.lastScienceSpent = 0;
    state.lastCompletedTechnologyIds = [];

    const validActiveTechnologyIds = getAvailableActiveTechnologyIds(state, technologyById);
    state.activeTechnologyIds = validActiveTechnologyIds;
    state.activeTechnologyId = validActiveTechnologyIds[0] ?? null;
    if (validActiveTechnologyIds.length === 0 || resources.science <= 0) {
      params.worldBase.technologyByCountry[countryId] = state;
      continue;
    }

    const result = spendScienceOnTechnologies({
      countryId,
      resources,
      state,
      technologyById,
      activeTechnologyIds: validActiveTechnologyIds,
      resolveTechnologyCost: params.resolveTechnologyCost,
    });

    for (const technologyId of result.completedTechnologyIds) {
      const technology = technologyById.get(technologyId);
      if (!technology) continue;
      completions.push({
        countryId,
        technologyId,
        technologyName: technology.name ?? technology.id,
      });
    }

    state.activeTechnologyIds = validActiveTechnologyIds.filter((technologyId) => !state.researchedTechnologyIds.includes(technologyId));
    state.activeTechnologyId = state.activeTechnologyIds[0] ?? null;
    params.worldBase.technologyByCountry[countryId] = state;
  }

  return completions;
}

export function getAvailableActiveTechnologyIds(
  state: CountryTechnologyState,
  technologyById: Map<string, TechnologyContentEntry>,
): string[] {
  const researchedTechnologyIds = new Set(normalizeIdList(state.researchedTechnologyIds));
  return normalizeIdList(state.activeTechnologyIds).filter((technologyId) => {
    const technology = technologyById.get(technologyId);
    if (!technology || researchedTechnologyIds.has(technology.id)) return false;
    return normalizeIdList(technology.prerequisiteTechnologyIds).every((prerequisiteId) =>
      researchedTechnologyIds.has(prerequisiteId),
    );
  });
}

function spendScienceOnTechnologies(params: {
  countryId: string;
  resources: ResourceTotals;
  state: CountryTechnologyState;
  technologyById: Map<string, TechnologyContentEntry>;
  activeTechnologyIds: string[];
  resolveTechnologyCost: (countryId: string, technology: TechnologyContentEntry) => number;
}): { completedTechnologyIds: string[] } {
  let remainingScience = Math.max(0, Number(params.resources.science ?? 0));
  let spentTotal = 0;
  let remainingTechnologyIds = [...params.activeTechnologyIds];
  const completedTechnologyIds: string[] = [];

  while (remainingScience > 1e-9 && remainingTechnologyIds.length > 0) {
    const share = remainingScience / remainingTechnologyIds.length;
    let spentThisPass = 0;
    const nextRemainingTechnologyIds: string[] = [];

    for (const technologyId of remainingTechnologyIds) {
      const technology = params.technologyById.get(technologyId);
      if (!technology) continue;
      const cost = Math.max(1, params.resolveTechnologyCost(params.countryId, technology));
      const currentProgress = Math.max(0, Number(params.state.progressByTechnologyId[technology.id] ?? 0));
      const needed = Math.max(0, cost - currentProgress);
      if (needed <= 1e-9) {
        params.state.progressByTechnologyId[technology.id] = cost;
        completedTechnologyIds.push(technology.id);
        continue;
      }
      const spent = Math.min(share, needed);
      if (spent <= 1e-9) {
        nextRemainingTechnologyIds.push(technology.id);
        continue;
      }
      spentThisPass += spent;
      const nextProgress = round3(currentProgress + spent);
      if (nextProgress + 1e-9 >= cost) {
        params.state.progressByTechnologyId[technology.id] = cost;
        completedTechnologyIds.push(technology.id);
      } else {
        params.state.progressByTechnologyId[technology.id] = nextProgress;
        nextRemainingTechnologyIds.push(technology.id);
      }
    }

    if (spentThisPass <= 1e-9) break;
    spentTotal += spentThisPass;
    remainingScience = Math.max(0, remainingScience - spentThisPass);
    remainingTechnologyIds = nextRemainingTechnologyIds;
  }

  if (spentTotal > 0) {
    params.resources.science = round3(Math.max(0, Number(params.resources.science ?? 0) - spentTotal));
    params.state.lastScienceSpent = round3(spentTotal);
  }

  if (completedTechnologyIds.length > 0) {
    const completedIds = normalizeIdList(completedTechnologyIds);
    params.state.researchedTechnologyIds = normalizeIdList([...params.state.researchedTechnologyIds, ...completedIds]);
    params.state.lastCompletedTechnologyIds = completedIds;
  }

  return { completedTechnologyIds: normalizeIdList(completedTechnologyIds) };
}

function normalizeIdList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<string>();
  const items: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    const key = value.toLocaleLowerCase("ru");
    if (!value || unique.has(key)) continue;
    unique.add(key);
    items.push(value);
  }
  return items.slice(0, 256);
}

function round3(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}
