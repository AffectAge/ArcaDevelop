export type ServerStatus = "online" | "offline" | "maintenance";

export type Country = {
  id: string;
  name: string;
  color: string;
  marketId?: string | null;
  flagUrl?: string | null;
  crestUrl?: string | null;
  isAdmin?: boolean;
  isLocked?: boolean;
  blockedUntilTurn?: number | null;
  blockedUntilAt?: string | null;
  lockReason?: string | null;
  ignoreUntilTurn?: number | null;
  eventLogRetentionTurns?: number | null;
  isRegistrationApproved?: boolean;
};

export type ResourceTotals = {
  culture: number;
  science: number;
  religion: number;
  colonization: number;
  construction: number;
  ducats: number;
  gold: number;
};
