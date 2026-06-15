import { describe, expect, it } from "vitest";
import type { WorldDelta } from "@arcanorum/shared";
import {
  getWorldDeltaLogStatus,
  loadPersistedWorldDeltaHistory,
  persistWorldDeltaToDb,
  prunePersistedWorldDeltaLog,
  syncPersistedWorldDeltaLogWithCurrentState,
} from "./worldDeltaLogPersistence";

class FakePrismaWorldDeltaLogClient {
  executeRawCalls: Array<{ query: string; values: unknown[] }> = [];
  executeRawUnsafeCalls: string[] = [];
  queryRows: unknown = [];

  async $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number> {
    this.executeRawCalls.push({ query: query.join("?"), values });
    return 0;
  }

  async $executeRawUnsafe(sql: string): Promise<number> {
    this.executeRawUnsafeCalls.push(sql);
    return 0;
  }

  async $queryRaw<T>(): Promise<T> {
    return this.queryRows as T;
  }
}

const worldDelta: WorldDelta = {
  type: "WORLD_DELTA",
  turnId: 2,
  worldStateVersion: 7,
  mask: 0,
  rejectedOrders: [],
};

describe("worldDeltaLogPersistence", () => {
  it("persists compact world delta payloads", async () => {
    const prisma = new FakePrismaWorldDeltaLogClient();

    await persistWorldDeltaToDb(prisma, worldDelta);

    expect(prisma.executeRawCalls).toHaveLength(1);
    expect(prisma.executeRawCalls[0]?.query).toContain("INSERT OR IGNORE INTO WorldDeltaLog");
    expect(prisma.executeRawCalls[0]?.values).toEqual([7, 2, JSON.stringify(worldDelta)]);
  });

  it("prunes to a positive bounded maximum", async () => {
    const prisma = new FakePrismaWorldDeltaLogClient();

    await prunePersistedWorldDeltaLog(prisma, 100);

    expect(prisma.executeRawUnsafeCalls.join("\n")).toContain("LIMIT 100");
    await expect(prunePersistedWorldDeltaLog(prisma, 0)).rejects.toThrow("maxEntries must be a positive integer.");
  });

  it("removes rows newer than current world state version", async () => {
    const prisma = new FakePrismaWorldDeltaLogClient();

    await syncPersistedWorldDeltaLogWithCurrentState(prisma, 12);

    expect(prisma.executeRawCalls[0]?.query).toContain("DELETE FROM WorldDeltaLog WHERE worldStateVersion >");
    expect(prisma.executeRawCalls[0]?.values).toEqual([12]);
  });

  it("loads valid persisted deltas in chronological order and ignores malformed rows", async () => {
    const prisma = new FakePrismaWorldDeltaLogClient();
    prisma.queryRows = [
      { worldStateVersion: 3, payloadJson: JSON.stringify({ ...worldDelta, worldStateVersion: 3 }) },
      { worldStateVersion: 2, payloadJson: "{bad" },
      { worldStateVersion: 1, payloadJson: JSON.stringify({ ...worldDelta, worldStateVersion: 1 }) },
    ];

    const result = await loadPersistedWorldDeltaHistory(prisma, { currentWorldStateVersion: 3, limit: 10 });

    expect(result.map((delta) => delta.worldStateVersion)).toEqual([1, 3]);
  });

  it("reads bounded log status", async () => {
    const prisma = new FakePrismaWorldDeltaLogClient();
    prisma.queryRows = [{ depth: 5, oldest: 10, newest: 14 }];

    await expect(getWorldDeltaLogStatus(prisma)).resolves.toEqual({
      dbDepth: 5,
      dbOldestWorldStateVersion: 10,
      dbNewestWorldStateVersion: 14,
    });
  });
});
