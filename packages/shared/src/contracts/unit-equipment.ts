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
