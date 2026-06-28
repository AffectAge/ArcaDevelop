import { randomUUID } from "node:crypto";
import type {
  DivisionStats,
  DivisionTemplateBattalion,
  MilitaryBranch,
  MilitaryTemplateComponent,
  WorldBase,
} from "@arcanorum/shared";
import type { BattalionContentEntry, GameSettings, MilitaryContentEntry } from "./gameSettingsTypes";
import type { GoodFlow } from "../mechanics/contentFieldNormalizers";
import {
  calculateDivisionStatsForRuntime,
  calculateDivisionTrainingCostForRuntime,
  calculateMilitaryFormationCostForRuntime,
  calculateMilitaryStatsForRuntime,
  componentsToDivisionBattalionsForRuntime,
  getBattalionContentById as getBattalionContentByIdFromRuntime,
  getMilitaryContentById as getMilitaryContentByIdFromRuntime,
  normalizeDivisionTemplatesByCountryForRuntime,
  normalizeDivisionsByIdForRuntime,
  normalizeMilitaryFormationQueueByCountryForRuntime,
  normalizeMilitaryTemplateComponentsForRuntime,
  refreshDivisionStatsFromTemplatesForRuntime,
} from "./militaryRuntimeState";
import type { DefaultBattalionKind } from "./gameSettingsTypes";

type MilitaryRuntimeFacadeParams = {
  getGameSettings: () => GameSettings;
  getWorldBase: () => WorldBase;
  getTurnId: () => number;
  defaultBattalions: Array<{ id: DefaultBattalionKind | string }>;
};

export function createMilitaryRuntimeFacade(params: MilitaryRuntimeFacadeParams) {
  function getContent(): GameSettings["content"] {
    return params.getGameSettings().content;
  }

  function getBattalionContentById(id: string): BattalionContentEntry | null {
    return getBattalionContentByIdFromRuntime(getContent(), id) as BattalionContentEntry | null;
  }

  function getMilitaryContentById(kind: MilitaryBranch, id: string): MilitaryContentEntry | null {
    return getMilitaryContentByIdFromRuntime(getContent(), kind, id) as MilitaryContentEntry | null;
  }

  function normalizeMilitaryTemplateComponents(
    input: unknown,
    kind: MilitaryBranch,
    fallbackBattalions?: DivisionTemplateBattalion[],
  ): MilitaryTemplateComponent[] {
    return normalizeMilitaryTemplateComponentsForRuntime({
      input,
      kind,
      content: getContent(),
      fallbackBattalions,
      createId: randomUUID,
    });
  }

  function componentsToDivisionBattalions(components: MilitaryTemplateComponent[]): DivisionTemplateBattalion[] {
    return componentsToDivisionBattalionsForRuntime(getContent(), components);
  }

  function calculateDivisionStats(battalions: DivisionTemplateBattalion[]): DivisionStats {
    return calculateDivisionStatsForRuntime(getContent(), battalions);
  }

  function calculateMilitaryStats(kind: MilitaryBranch, components: MilitaryTemplateComponent[]): DivisionStats {
    return calculateMilitaryStatsForRuntime({ content: getContent(), kind, components });
  }

  function calculateDivisionTrainingCost(battalions: DivisionTemplateBattalion[]): {
    ducats: number;
    manpower: number;
    equipmentNeeds: GoodFlow[];
  } {
    return calculateDivisionTrainingCostForRuntime(getContent(), battalions);
  }

  function calculateMilitaryFormationCost(kind: MilitaryBranch, components: MilitaryTemplateComponent[]): {
    ducats: number;
    manpower: number;
    equipmentNeeds: GoodFlow[];
  } {
    return calculateMilitaryFormationCostForRuntime({ content: getContent(), kind, components });
  }

  function refreshDivisionStatsFromTemplates(): void {
    refreshDivisionStatsFromTemplatesForRuntime({
      worldBase: params.getWorldBase(),
      content: getContent(),
      defaultBattalions: params.defaultBattalions,
      createId: randomUUID,
      turnId: params.getTurnId(),
    });
  }

  function normalizeDivisionTemplatesByCountry(input: unknown): WorldBase["divisionTemplatesByCountry"] {
    return normalizeDivisionTemplatesByCountryForRuntime({
      input,
      content: getContent(),
      defaultBattalions: params.defaultBattalions,
      createId: randomUUID,
      turnId: params.getTurnId(),
    });
  }

  function normalizeDivisionsById(input: unknown, base: WorldBase = params.getWorldBase()): WorldBase["divisionsById"] {
    return normalizeDivisionsByIdForRuntime({ input, worldBase: base, createId: randomUUID, turnId: params.getTurnId() });
  }

  function normalizeMilitaryFormationQueueByCountry(input: unknown): WorldBase["militaryFormationQueueByCountry"] {
    return normalizeMilitaryFormationQueueByCountryForRuntime({ input, createId: randomUUID, turnId: params.getTurnId() });
  }

  return {
    calculateDivisionStats,
    calculateDivisionTrainingCost,
    calculateMilitaryFormationCost,
    calculateMilitaryStats,
    componentsToDivisionBattalions,
    getBattalionContentById,
    getMilitaryContentById,
    normalizeDivisionTemplatesByCountry,
    normalizeDivisionsById,
    normalizeMilitaryFormationQueueByCountry,
    normalizeMilitaryTemplateComponents,
    refreshDivisionStatsFromTemplates,
  };
}
