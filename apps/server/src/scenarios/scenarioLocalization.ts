import { existsSync, readFileSync } from "node:fs";

export type ScenarioLocalization = Record<string, string>;

export function readFlatScenarioLocalizationFile(path: string): ScenarioLocalization {
  if (!existsSync(path)) return {};
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const result: ScenarioLocalization = {};
  collectFlatLocalizationKeys("", raw, result);
  return result;
}

export function resolveLocalizedValue(params: {
  value: unknown;
  nameKey: unknown;
  preferred: ScenarioLocalization;
  fallback: ScenarioLocalization;
  fallbackValue: string;
}): string {
  if (typeof params.value === "string" && params.value.trim()) return params.value.trim();
  const nameKey = typeof params.nameKey === "string" && params.nameKey.trim() ? params.nameKey.trim() : null;
  if (nameKey) return params.preferred[nameKey] ?? params.fallback[nameKey] ?? params.fallbackValue;
  return params.fallbackValue;
}

function collectFlatLocalizationKeys(prefix: string, value: unknown, result: ScenarioLocalization): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") {
      result[nextKey] = child;
      continue;
    }
    collectFlatLocalizationKeys(nextKey, child, result);
  }
}
