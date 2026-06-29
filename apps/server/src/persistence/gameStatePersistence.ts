import { Prisma } from "@prisma/client";
import type { AdminAuditLogEntry } from "../security/adminAuditLog";
import type { GameStatePayload } from "./gameStatePayload";
import type { SerializedOrdersByTurn, SerializedResolveReadyByTurn } from "./turnStatePersistence";

export type GameStateDbWrite = {
  id?: string;
  turnId: number;
  gameSettingsJson: Prisma.InputJsonValue;
  worldBaseJson: Prisma.InputJsonValue;
  ordersByTurnJson: Prisma.InputJsonValue;
  resolveReadyByTurnJson: Prisma.InputJsonValue;
  adminAuditLogJson: Prisma.InputJsonValue;
};

export type GameStateDbRow = {
  turnId: number;
  gameSettingsJson: unknown;
  worldBaseJson: unknown;
  ordersByTurnJson: unknown;
  resolveReadyByTurnJson: unknown;
  adminAuditLogJson: unknown;
};

export type GameStatePersistenceClient = {
  gameState: {
    upsert(args: { where: { id: string }; create: GameStateDbWrite & { id: string }; update: GameStateDbWrite }): Promise<unknown>;
    findUnique(args: { where: { id: string } }): Promise<GameStateDbRow | null>;
  };
};

export type PersistedGameStateInput = {
  turnId: number;
  gameSettings: unknown;
  worldBase: unknown;
  ordersByTurn: unknown;
  resolveReadyByTurn: unknown;
  adminAuditLog: unknown;
};

export async function saveGameStatePayload<TGameSettings, TMarketOverview>(
  prisma: GameStatePersistenceClient,
  rowId: string,
  payload: GameStatePayload<TGameSettings, TMarketOverview>,
): Promise<void> {
  const write = buildGameStateDbWrite(payload);
  await prisma.gameState.upsert({
    where: { id: rowId },
    create: {
      id: rowId,
      ...write,
    },
    update: write,
  });
}

export async function loadGameStatePayload(
  prisma: GameStatePersistenceClient,
  rowId: string,
): Promise<PersistedGameStateInput | null> {
  const row = await prisma.gameState.findUnique({ where: { id: rowId } });
  if (!row) return null;
  return {
    turnId: row.turnId,
    gameSettings: row.gameSettingsJson,
    worldBase: row.worldBaseJson,
    ordersByTurn: row.ordersByTurnJson,
    resolveReadyByTurn: row.resolveReadyByTurnJson,
    adminAuditLog: row.adminAuditLogJson,
  };
}

function buildGameStateDbWrite<TGameSettings, TMarketOverview>(
  payload: GameStatePayload<TGameSettings, TMarketOverview>,
): GameStateDbWrite {
  return {
    turnId: payload.turnId,
    gameSettingsJson: stripAuthoredContentFromGameSettings(payload.gameSettings) as unknown as Prisma.InputJsonValue,
    worldBaseJson: payload.worldBase as unknown as Prisma.InputJsonValue,
    ordersByTurnJson: payload.ordersByTurn as unknown as Prisma.InputJsonValue,
    resolveReadyByTurnJson: payload.resolveReadyByTurn as unknown as Prisma.InputJsonValue,
    adminAuditLogJson: payload.adminAuditLog as unknown as Prisma.InputJsonValue,
  };
}

function stripAuthoredContentFromGameSettings(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const { content: _content, ...rest } = input as Record<string, unknown>;
  return rest;
}

export function createEmptyPersistedGameStateInput(): PersistedGameStateInput {
  return {
    turnId: 1,
    gameSettings: {},
    worldBase: {},
    ordersByTurn: [] satisfies SerializedOrdersByTurn,
    resolveReadyByTurn: [] satisfies SerializedResolveReadyByTurn,
    adminAuditLog: [] satisfies AdminAuditLogEntry[],
  };
}
