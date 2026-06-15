import { describe, expect, it } from "vitest";
import type { WorldBase } from "@arcanorum/shared";
import { buildGameStatePayload } from "./gameStatePayload";
import {
  loadGameStatePayload,
  saveGameStatePayload,
  type GameStateDbRow,
  type GameStatePersistenceClient,
} from "./gameStatePersistence";

class FakeGameStateClient implements GameStatePersistenceClient {
  upsertArgs: unknown = null;
  row: GameStateDbRow | null = null;

  gameState = {
    upsert: async (args: unknown): Promise<unknown> => {
      this.upsertArgs = args;
      return {};
    },
    findUnique: async (): Promise<GameStateDbRow | null> => this.row,
  };
}

describe("gameStatePersistence", () => {
  it("saves payload through one GameState upsert", async () => {
    const prisma = new FakeGameStateClient();
    const payload = buildGameStatePayload({
      turnId: 5,
      activeScenarioId: "scenario:demo",
      activeScenarioName: "Demo",
      gameSettings: { registration: { requireAdminApproval: true } },
      worldBase: { turnId: 5 } as WorldBase,
      latestMarketOverview: { markets: [] },
      ordersByTurn: [],
      resolveReadyByTurn: [],
      adminAuditLog: [],
    });

    await saveGameStatePayload(prisma, "primary", payload);

    expect(prisma.upsertArgs).toMatchObject({
      where: { id: "primary" },
      create: {
        id: "primary",
        turnId: 5,
      },
      update: {
        turnId: 5,
      },
    });
  });

  it("loads a persisted row into parser input shape", async () => {
    const prisma = new FakeGameStateClient();
    prisma.row = {
      turnId: 7,
      gameSettingsJson: { economy: {} },
      worldBaseJson: { turnId: 7 },
      ordersByTurnJson: [["7", []]],
      resolveReadyByTurnJson: [["7", []]],
      adminAuditLogJson: [{ id: "audit:1" }],
    };

    await expect(loadGameStatePayload(prisma, "primary")).resolves.toEqual({
      turnId: 7,
      gameSettings: { economy: {} },
      worldBase: { turnId: 7 },
      ordersByTurn: [["7", []]],
      resolveReadyByTurn: [["7", []]],
      adminAuditLog: [{ id: "audit:1" }],
    });
  });

  it("returns null when no row exists", async () => {
    const prisma = new FakeGameStateClient();

    await expect(loadGameStatePayload(prisma, "primary")).resolves.toBeNull();
  });
});
