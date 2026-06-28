import type { HexId } from "./hex-map";
import type { EquipmentStats, MilitaryEquipmentRequirement } from "./unit-equipment";

export type DivisionTemplateBattalion = {
  id: string;
  battalionTypeId: string;
  count: number;
};

export type MilitaryBranch = "land" | "naval" | "air";

export type MilitaryTemplateComponent = {
  id: string;
  typeId: string;
  count: number;
  role?: "line" | "support";
};

export type DivisionStats = {
  manpower: number;
  attack: number;
  defense: number;
  breakthrough: number;
  armor?: number;
  piercing?: number;
  organization: number;
  hp: number;
  speed: number;
  range?: number;
  reliability?: number;
  supplyUse: number;
  fuelUse?: number;
};

export type DivisionTemplate = {
  id: string;
  countryId: string;
  name: string;
  kind?: MilitaryBranch;
  iconUrl?: string | null;
  battalions: DivisionTemplateBattalion[];
  components?: MilitaryTemplateComponent[];
  equipmentRequirements?: MilitaryEquipmentRequirement[];
  stats: DivisionStats;
  createdTurnId: number;
  updatedTurnId: number;
};

export type DivisionStatus = "idle" | "moving" | "fighting" | "retreating";
export type FleetStatus = "idle" | "moving" | "fighting" | "repairing";
export type AirWingStatus = "idle" | "mission" | "reorganizing";

export type DivisionSupplyPriority = "low" | "normal" | "high";

export type DivisionEquipmentAssignment = {
  requirementId: string;
  equipmentVariantId: string | null;
  score: number;
  requiredCount: number;
  assignedCount: number;
  coverage: number;
  variants?: Array<{
    equipmentVariantId: string;
    amount: number;
    score: number;
    stats: EquipmentStats;
    manpowerCrew: number;
  }>;
};

export type DivisionEquipmentSupplyReport = {
  turnId?: number | null;
  receivedByVariantId: Record<string, number>;
  returnedByVariantId: Record<string, number>;
};

export type Division = {
  id: string;
  countryId: string;
  templateId: string;
  name: string;
  kind?: MilitaryBranch;
  hexId: HexId;
  strength: number;
  organization: number;
  stats: DivisionStats;
  equipmentCoverage?: number;
  equipmentAssignments?: DivisionEquipmentAssignment[];
  equipmentByVariantId?: Record<string, number>;
  equipmentSupplyReport?: DivisionEquipmentSupplyReport;
  supplyPriority?: DivisionSupplyPriority;
  status: DivisionStatus;
  path: HexId[];
  targetHexId?: HexId | null;
  createdTurnId: number;
  lastMovedTurnId?: number | null;
};

export type Fleet = {
  id: string;
  countryId: string;
  templateId: string;
  name: string;
  hexId: HexId;
  strength: number;
  organization: number;
  stats: DivisionStats;
  equipmentCoverage?: number;
  equipmentAssignments?: DivisionEquipmentAssignment[];
  equipmentByVariantId?: Record<string, number>;
  equipmentSupplyReport?: DivisionEquipmentSupplyReport;
  supplyPriority?: DivisionSupplyPriority;
  status: FleetStatus;
  path: HexId[];
  targetHexId?: HexId | null;
  createdTurnId: number;
  lastMovedTurnId?: number | null;
};

export type AirWing = {
  id: string;
  countryId: string;
  templateId: string;
  name: string;
  baseHexId: HexId;
  strength: number;
  organization: number;
  stats: DivisionStats;
  equipmentCoverage?: number;
  equipmentAssignments?: DivisionEquipmentAssignment[];
  equipmentByVariantId?: Record<string, number>;
  equipmentSupplyReport?: DivisionEquipmentSupplyReport;
  supplyPriority?: DivisionSupplyPriority;
  status: AirWingStatus;
  mission?: "none" | "air_superiority" | "ground_support" | "interception" | "naval_patrol";
  targetRegionId?: string | null;
  createdTurnId: number;
};

export type MilitaryFormationQueueItem = {
  id: string;
  countryId: string;
  kind: MilitaryBranch;
  templateId: string;
  name: string;
  hexId: HexId;
  quantity: number;
  remainingQuantity: number;
  priority: "high" | "normal" | "low";
  repeat: boolean;
  stalledReasonCode?: string | null;
  progress: number;
  turnsTotal: number;
  turnsRemaining: number;
  cost: {
    ducats: number;
    manpower: number;
    equipmentNeeds: Array<{ goodId: string; amount: number }>;
  };
  createdTurnId: number;
};
