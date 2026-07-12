import type { HexId } from "./hex-map";

export type TurnActionKind =
  | "unit_can_act"
  | "unit_can_promote"
  | "research_required"
  | "civic_required"
  | "production_available"
  | "event_required"
  | "diplomacy_required";

export type TurnActionSeverity = "blocking" | "warning" | "info";

export type TurnActionTarget =
  | { type: "unit"; unitId: string; hexId: HexId }
  | { type: "hex"; hexId: HexId }
  | { type: "country"; countryId: string };

export type TurnActionCommand =
  | { type: "focus_hex"; hexId: HexId; unitId?: string }
  | { type: "open_strategy_mode"; mode: string }
  | { type: "open_modal"; modal: string; targetId?: string }
  | { type: "noop" };

export type TurnActionItem = {
  id: string;
  countryId: string;
  kind: TurnActionKind;
  severity: TurnActionSeverity;
  target: TurnActionTarget;
  labelKey: string;
  descriptionKey: string;
  action: TurnActionCommand;
};

export type TurnActionChecklist = {
  turnId: number;
  countryId: string;
  items: TurnActionItem[];
  blockingCount: number;
};
