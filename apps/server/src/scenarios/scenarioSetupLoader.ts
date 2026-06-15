import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type ScenarioSetupFiles = {
  countryResources: unknown | null;
  provinceOwners: unknown | null;
  provinceNames: unknown | null;
  countryTechnologies: unknown | null;
  diplomacy: unknown | null;
};

export function loadScenarioSetupFiles(scenarioDir: string | null): ScenarioSetupFiles {
  return {
    countryResources: readScenarioSetupFile(scenarioDir, "country_resources.json"),
    provinceOwners: readScenarioSetupFile(scenarioDir, "province_owners.json"),
    provinceNames: readScenarioSetupFile(scenarioDir, "province_names.json"),
    countryTechnologies: readScenarioSetupFile(scenarioDir, "country_technologies.json"),
    diplomacy: readScenarioSetupFile(scenarioDir, "diplomacy.json"),
  };
}

function readScenarioSetupFile(scenarioDir: string | null, fileName: string): unknown | null {
  if (!scenarioDir) return null;
  const path = resolve(scenarioDir, "setup", fileName);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}
