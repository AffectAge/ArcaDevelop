import type { Order } from "@arcanorum/shared";

export type SerializedOrdersByTurn = Array<{
  turnId: number;
  players: Array<{ playerId: string; orders: Order[] }>;
}>;

export type SerializedResolveReadyByTurn = Array<{
  turnId: number;
  countryIds: string[];
}>;

export function serializeOrdersByTurnState(ordersByTurn: Map<number, Map<string, Order[]>>): SerializedOrdersByTurn {
  return [...ordersByTurn.entries()].map(([savedTurnId, players]) => ({
    turnId: savedTurnId,
    players: [...players.entries()].map(([playerId, orders]) => ({ playerId, orders })),
  }));
}

export function serializeResolveReadyByTurnState(resolveReadyByTurn: Map<number, Set<string>>): SerializedResolveReadyByTurn {
  return [...resolveReadyByTurn.entries()].map(([savedTurnId, readySet]) => ({
    turnId: savedTurnId,
    countryIds: [...readySet],
  }));
}

export function restoreOrdersByTurnState(input: unknown): Map<number, Map<string, Order[]>> {
  const result = new Map<number, Map<string, Order[]>>();
  if (!Array.isArray(input)) return result;

  for (const turnEntry of input) {
    if (!turnEntry || typeof turnEntry !== "object") {
      continue;
    }
    const savedTurn = (turnEntry as { turnId?: unknown }).turnId;
    const players = (turnEntry as { players?: unknown }).players;
    if (typeof savedTurn !== "number" || !Number.isFinite(savedTurn) || !Array.isArray(players)) {
      continue;
    }

    const playerMap = new Map<string, Order[]>();
    for (const playerEntry of players) {
      if (!playerEntry || typeof playerEntry !== "object") {
        continue;
      }
      const savedPlayerId = (playerEntry as { playerId?: unknown }).playerId;
      const savedOrders = (playerEntry as { orders?: unknown }).orders;
      if (typeof savedPlayerId !== "string" || !Array.isArray(savedOrders)) {
        continue;
      }
      playerMap.set(savedPlayerId, savedOrders as Order[]);
    }
    if (playerMap.size > 0) {
      result.set(Math.floor(savedTurn), playerMap);
    }
  }

  return result;
}

export function restoreResolveReadyByTurnState(input: unknown): Map<number, Set<string>> {
  const result = new Map<number, Set<string>>();
  if (!Array.isArray(input)) return result;

  for (const turnEntry of input) {
    if (!turnEntry || typeof turnEntry !== "object") {
      continue;
    }
    const savedTurn = (turnEntry as { turnId?: unknown }).turnId;
    const countryIds = (turnEntry as { countryIds?: unknown }).countryIds;
    if (typeof savedTurn !== "number" || !Number.isFinite(savedTurn) || !Array.isArray(countryIds)) {
      continue;
    }
    const ids = countryIds.filter((id): id is string => typeof id === "string");
    if (ids.length > 0) {
      result.set(Math.floor(savedTurn), new Set(ids));
    }
  }

  return result;
}
