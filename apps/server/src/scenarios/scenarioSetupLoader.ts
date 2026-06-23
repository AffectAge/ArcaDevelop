import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type ScenarioSetupFiles = {
  countryResources: unknown | null;
  hexOwners: unknown | null;
  hexNames: unknown | null;
  countryTechnologies: unknown | null;
  diplomacy: unknown | null;
};

export function loadScenarioSetupFiles(scenarioDir: string | null): ScenarioSetupFiles {
  return {
    countryResources: readScenarioSetupFile(scenarioDir, "country_resources.json"),
    hexOwners: readScenarioSetupFile(scenarioDir, "hex_owners.json"),
    hexNames: readScenarioSetupFile(scenarioDir, "hex_names.json"),
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
