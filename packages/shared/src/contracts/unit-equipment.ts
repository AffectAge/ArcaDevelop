import type { HexId } from "./hex-map";

export type CivilianUnitType = "colonizer";

export type CivilianUnitStatus = "idle" | "moving" | "founding" | "captured";

export type CivilianUnit = {
  id: string;
  countryId: string;
  type: CivilianUnitType;
  hexId: HexId;
  status: CivilianUnitStatus;
  movementPoints: number;
  maxMovementPoints: number;
  path: HexId[];
  targetHexId?: HexId | null;
  createdTurnId: number;
  lastMovedTurnId?: number | null;
  capturedByCountryId?: string | null;
};

export type CivilianUnitQueueItem = {
  id: string;
  countryId: string;
  type: CivilianUnitType;
  hexId: HexId;
  progress: number;
  turnsTotal: number;
  turnsRemaining: number;
  cost: {
    colonization: number;
    ducats: number;
  };
  createdTurnId: number;
};

export type SettlementVisualState = "underConstruction" | "working" | "burning" | "ruins";

export type SettlementProjectState = "active" | "stalled" | "completed" | "canceled";

export type SettlementProject = {
  id: string;
  name: string;
  countryId: string;
  regionId: string;
  targetHexId: HexId;
  cultureId: string;
  progressColonization: number;
  costColonization: number;
  state: SettlementProjectState;
  visualState: SettlementVisualState;
  createdTurnId: number;
  completedTurnId?: number | null;
  stallReasonCode?: string | null;
};

export type CityMarker = {
  id: string;
  name: string;
  countryId: string;
  ownerCountryId: string;
  regionId: string;
  targetHexId: HexId;
  cultureId: string;
  visualState: SettlementVisualState;
  createdTurnId: number;
};

export type EquipmentBranch = "land" | "air" | "naval";

export type EquipmentStatKey =
  | "attack"
  | "defense"
  | "breakthrough"
  | "armor"
  | "piercing"
  | "speed"
  | "range"
  | "reliability"
  | "supplyUse"
  | "fuelUse";

export type EquipmentStats = Partial<Record<EquipmentStatKey, number>>;

export type EquipmentGoodsCost = Array<{ goodId: string; amount: number }>;

export type EquipmentClassRole = "attack" | "defense" | "breakthrough" | "speed" | "range" | "support";

export type EquipmentClass = {
  id: string;
  branch: EquipmentBranch;
  slotIds: string[];
  roles: EquipmentClassRole[];
  baseStats?: EquipmentStats;
};

export type EquipmentFrame = {
  id: string;
  classId: string;
  branch: EquipmentBranch;
  slotIds: string[];
  baseStats?: EquipmentStats;
  goodsCost?: EquipmentGoodsCost;
  manpowerCrew?: number;
  productionCost?: number;
  era?: string | null;
  unlockTechnologyId?: string | null;
};

export type EquipmentModule = {
  id: string;
  classId?: string | null;
  slotId: string;
  stats: EquipmentStats;
  goodsCost: EquipmentGoodsCost;
  manpowerCrew?: number;
  productionCost?: number;
};

export type EquipmentVariant = {
  id: string;
  countryId?: string | null;
  classId: string;
  frameId?: string | null;
  name: string;
  moduleIdsBySlotId: Record<string, string>;
  stats: EquipmentStats;
  goodsCost: EquipmentGoodsCost;
  manpowerCrew?: number;
  productionCost?: number;
  createdTurnId: number;
  scenarioAuthored?: boolean;
};

export type EquipmentProductionLine = {
  id: string;
  countryId: string;
  equipmentVariantId: string;
  assignedCapacity: number;
  progress: number;
  active: boolean;
  lastStatus?: "active" | "idle" | "stalled" | "invalid";
  lastProduced?: number;
  lastMissingGoods?: Array<{ goodId: string; required: number; available: number; missing: number }>;
  createdTurnId: number;
};

export type EquipmentStockpileByCountry = Record<string, Record<string, number>>;

export type MilitaryEquipmentRequirement = {
  id: string;
  equipmentClassId: string;
  role: EquipmentClassRole;
  count: number;
};
