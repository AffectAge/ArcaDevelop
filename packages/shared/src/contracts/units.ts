import type { HexId } from "./hex-map";

export type UnitDomain = "civilian" | "land" | "naval" | "air";

export type UnitCombatClass = "civilian" | "melee" | "ranged" | "cavalry" | "siege" | "naval_melee" | "naval_ranged" | "air";

export type UnitStats = {
  maxHp: number;
  attack: number;
  defense: number;
  rangedAttack?: number;
  range?: number;
  movement: number;
  vision?: number;
};

export type UnitProductionCost = {
  ducats?: number;
  construction?: number;
  colonization?: number;
  goods?: Array<{ goodId: string; amount: number }>;
};

export type UnitVisualDefinition = {
  atlasAssetId?: string | null;
  atlasPath?: string | null;
  frameWidth: number;
  frameHeight: number;
  states: Partial<Record<"idle" | "move" | "attack" | "damaged", { frame: number }>>;
};

export type UnitTypeDefinition = {
  id: string;
  domain: UnitDomain;
  class: UnitCombatClass;
  nameKey: string;
  descriptionKey?: string | null;
  stats: UnitStats;
  productionCost: UnitProductionCost;
  unlockTechnologyId?: string | null;
  visual: UnitVisualDefinition;
  canFoundCity?: boolean;
};

export type MapUnitStatus = "idle" | "moving" | "fighting" | "sleeping" | "captured" | "destroyed" | "based";

export type MapUnit = {
  id: string;
  unitTypeId: string;
  countryId: string;
  hexId: HexId;
  hp: number;
  movementPoints: number;
  experience: number;
  promotionIds?: string[];
  status: MapUnitStatus;
  path: HexId[];
  targetHexId?: HexId | null;
  createdTurnId: number;
  lastActionTurnId?: number | null;
  capturedByCountryId?: string | null;
};

export type UnitTrainingQueueItem = {
  id: string;
  countryId: string;
  unitTypeId: string;
  regionId: string;
  hexId: HexId;
  progress: number;
  turnsTotal: number;
  turnsRemaining: number;
  cost: UnitProductionCost;
  createdTurnId: number;
};
