import { createModifierRuntime } from "./modifierRuntime";
import { createRuntimeRef } from "./runtimeRef";

type ModifierRuntimeInstance = ReturnType<typeof createModifierRuntime>;

export function createServerModifierFacadeRuntime(): {
  modifierRuntimeRef: ReturnType<typeof createRuntimeRef<ModifierRuntimeInstance>>["ref"];
  getModifierRuntime: ReturnType<typeof createRuntimeRef<ModifierRuntimeInstance>>["get"];
  modifierFacade: {
    modifierConditionsMatchCountry: (
      conditions: Parameters<ModifierRuntimeInstance["modifierConditionsMatchCountry"]>[0],
      countryId: string,
    ) => boolean;
    getActiveCountryModifierRows: (
      countryId: string,
    ) => ReturnType<ModifierRuntimeInstance["getActiveCountryModifierRows"]>;
    resolveModifiedValue: (
      stat: Parameters<ModifierRuntimeInstance["resolveModifiedValue"]>[0],
      base: number,
      context: Parameters<ModifierRuntimeInstance["resolveModifiedValue"]>[2],
    ) => number;
  };
} {
  const { ref: modifierRuntimeRef, get: getModifierRuntime } =
    createRuntimeRef<ModifierRuntimeInstance>("Modifier runtime");

  return {
    modifierRuntimeRef,
    getModifierRuntime,
    modifierFacade: {
      modifierConditionsMatchCountry: (conditions, countryId) =>
        getModifierRuntime().modifierConditionsMatchCountry(conditions, countryId),
      getActiveCountryModifierRows: (countryId) => getModifierRuntime().getActiveCountryModifierRows(countryId),
      resolveModifiedValue: (stat, base, context) => getModifierRuntime().resolveModifiedValue(stat, base, context),
    },
  };
}
