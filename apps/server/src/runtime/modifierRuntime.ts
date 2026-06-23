import type {
  CountryParliament,
  ModifierCondition,
  ModifierEffect,
  ModifierScope,
  ModifierStat,
  WorldBase,
} from "@arcanorum/shared";
import {
  normalizeModifierConditions,
  normalizeModifiers,
} from "../mechanics/contentDefinitionNormalizers";
import type { GameSettings } from "./gameSettingsTypes";

export type ModifierContext = {
  countryId: string;
  hexId?: string | null;
  buildingId?: string | null;
  goodId?: string | null;
  professionId?: string | null;
  resourceCategoryId?: string | null;
};

type ModifierRuntimeParams = {
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  ensureCountryParliament: (countryId: string) => CountryParliament;
  isTechnologyResearched: (countryId: string, technologyId: string) => boolean;
  round3: (value: number) => number;
};

export type ModifierRuntime = {
  modifierConditionsMatchCountry: (conditions: ModifierCondition[] | undefined, countryId: string) => boolean;
  getActiveCountryModifierRows: (countryId: string) => ActiveCountryModifierRow[];
  collectModifierEffects: (stat: ModifierStat, context: ModifierContext) => ModifierEffect[];
  resolveModifiedValue: (stat: ModifierStat, base: number, context: ModifierContext) => number;
};

export type ActiveCountryModifierRow = {
  id: string;
  label: string;
  sourceId: string;
  sourceName: string;
  sourceKind: "technology" | "law" | "building" | "modifier" | "event";
  scope: ModifierScope;
  effects: ModifierEffect[];
};

export function createModifierRuntime(params: ModifierRuntimeParams): ModifierRuntime {
  const countryHasBuilding = (countryId: string, buildingId: string): boolean => {
    const worldBase = params.getWorldBase();
    for (const [hexId, instances] of Object.entries(worldBase.regionBuildingsByRegion ?? {})) {
      if ((worldBase.hexOwner[hexId] ?? null) !== countryId) continue;
      if ((instances ?? []).some((instance) => instance.buildingId === buildingId)) return true;
    }
    return false;
  };

  const modifierConditionMatchesCountry = (condition: ModifierCondition, countryId: string): boolean => {
    let matches = true;
    if (condition.type === "law_active") {
      const parliament = params.ensureCountryParliament(countryId);
      const activeLawIds = new Set(Object.values(parliament.activeLawByGroupId ?? {}).filter(Boolean));
      matches = Boolean(condition.targetId && activeLawIds.has(condition.targetId));
    } else if (condition.type === "technology_researched") {
      matches = Boolean(condition.targetId && params.isTechnologyResearched(countryId, condition.targetId));
    } else if (condition.type === "country_is") {
      matches = condition.targetId === countryId;
    } else if (condition.type === "has_building") {
      matches = Boolean(condition.targetId && countryHasBuilding(countryId, condition.targetId));
    }
    return condition.invert ? !matches : matches;
  };

  const modifierConditionsMatchCountry = (conditions: ModifierCondition[] | undefined, countryId: string): boolean => {
    const normalized = normalizeModifierConditions(conditions);
    return normalized.every((condition) => modifierConditionMatchesCountry(condition, countryId));
  };

  const getActiveCountryModifierRows = (countryId: string): ActiveCountryModifierRow[] => {
    const rows: ActiveCountryModifierRow[] = [];
    const modifierEntries = params.getGameSettings().content.modifiers;
    for (const entry of modifierEntries) {
      for (const modifier of normalizeModifiers(entry.modifiers)) {
        if (!modifierConditionsMatchCountry(modifier.conditions, countryId)) continue;
        rows.push({
          id: `${entry.id}:${modifier.id}`,
          label: modifier.label,
          sourceId: entry.id,
          sourceName: entry.name,
          sourceKind: "modifier",
          scope: modifier.scope,
          effects: modifier.effects,
        });
      }
    }
    const worldBase = params.getWorldBase();
    const appliedModifiers = (worldBase.countryModifiersByCountryId[countryId] ?? []).filter(
      (entry) => entry.expiresTurnId == null || entry.expiresTurnId > worldBase.turnId,
    );
    for (const applied of appliedModifiers) {
      const entry = modifierEntries.find((candidate) => candidate.id === applied.modifierId);
      if (!entry) continue;
      for (const modifier of normalizeModifiers(entry.modifiers)) {
        if (!modifierConditionsMatchCountry(modifier.conditions, countryId)) continue;
        rows.push({
          id: `${applied.id}:${modifier.id}`,
          label: modifier.label,
          sourceId: applied.modifierId,
          sourceName: entry.name,
          sourceKind: applied.sourceSystem === "event" ? "event" : "modifier",
          scope: modifier.scope,
          effects: modifier.effects,
        });
      }
    }
    return rows;
  };

  const modifierEffectMatchesContext = (effect: ModifierEffect, context: ModifierContext): boolean => {
    const target = effect.target;
    if (!target) return true;
    if (target.buildingId && target.buildingId !== context.buildingId) return false;
    if (target.goodId && target.goodId !== context.goodId) return false;
    if (target.professionId && target.professionId !== context.professionId) return false;
    if (target.resourceCategoryId && target.resourceCategoryId !== context.resourceCategoryId) return false;
    return true;
  };

  const collectModifierEffects = (stat: ModifierStat, context: ModifierContext): ModifierEffect[] =>
    getActiveCountryModifierRows(context.countryId).flatMap((row) =>
      row.effects.filter((effect) => effect.stat === stat && modifierEffectMatchesContext(effect, context)),
    );

  const resolveModifiedValue = (stat: ModifierStat, base: number, context: ModifierContext): number => {
    const effects = collectModifierEffects(stat, context);
    let value = Number.isFinite(base) ? base : 0;
    for (const effect of effects.filter((entry) => entry.mode === "add")) {
      value += effect.value;
    }
    const addPct = effects
      .filter((entry) => entry.mode === "add_pct")
      .reduce((sum, effect) => sum + effect.value, 0);
    value *= 1 + addPct;
    for (const effect of effects.filter((entry) => entry.mode === "mult")) {
      value *= effect.value;
    }
    return params.round3(value);
  };

  return {
    modifierConditionsMatchCountry,
    getActiveCountryModifierRows,
    collectModifierEffects,
    resolveModifiedValue,
  };
}
