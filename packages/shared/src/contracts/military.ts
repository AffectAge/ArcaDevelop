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
  organization: number;
  hp: number;
  speed: number;
  supplyUse: number;
};

export type DivisionTemplate = {
  id: string;
  countryId: string;
  name: string;
  kind?: MilitaryBranch;
  iconUrl?: string | null;
  battalions: DivisionTemplateBattalion[];
  components?: MilitaryTemplateComponent[];
  stats: DivisionStats;
  createdTurnId: number;
  updatedTurnId: number;
};

export type DivisionStatus = "idle" | "moving" | "fighting" | "retreating";

export type Division = {
  id: string;
  countryId: string;
  templateId: string;
  name: string;
  kind?: MilitaryBranch;
  provinceId: string;
  strength: number;
  organization: number;
  stats: DivisionStats;
  status: DivisionStatus;
  path: string[];
  createdTurnId: number;
  lastMovedTurnId?: number | null;
};

export type MilitaryFormationQueueItem = {
  id: string;
  countryId: string;
  kind: MilitaryBranch;
  templateId: string;
  name: string;
  provinceId: string;
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
