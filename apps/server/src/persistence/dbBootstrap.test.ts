import { describe, expect, it } from "vitest";
import { ensureCorePrismaTables, ensureWorldDeltaLogTable } from "./dbBootstrap";

class FakePrismaBootstrapClient {
  executeCalls: string[] = [];
  existingColumns: Array<{ name: string }> = [];

  async $executeRawUnsafe(sql: string): Promise<number> {
    this.executeCalls.push(sql);
    return 0;
  }

  async $queryRawUnsafe<T>(): Promise<T> {
    return this.existingColumns as T;
  }
}

describe("dbBootstrap", () => {
  it("creates core tables and adds missing admin audit log column", async () => {
    const prisma = new FakePrismaBootstrapClient();

    await ensureCorePrismaTables(prisma);

    expect(prisma.executeCalls.join("\n")).toContain("CREATE TABLE IF NOT EXISTS Country");
    expect(prisma.executeCalls.join("\n")).toContain("CREATE TABLE IF NOT EXISTS GameState");
    expect(prisma.executeCalls.join("\n")).toContain("ALTER TABLE GameState ADD COLUMN adminAuditLogJson");
  });

  it("does not add admin audit log column when it already exists", async () => {
    const prisma = new FakePrismaBootstrapClient();
    prisma.existingColumns = [{ name: "adminAuditLogJson" }];

    await ensureCorePrismaTables(prisma);

    expect(prisma.executeCalls.join("\n")).not.toContain("ALTER TABLE GameState ADD COLUMN adminAuditLogJson");
  });

  it("creates world delta log table and index", async () => {
    const prisma = new FakePrismaBootstrapClient();

    await ensureWorldDeltaLogTable(prisma);

    expect(prisma.executeCalls.join("\n")).toContain("CREATE TABLE IF NOT EXISTS WorldDeltaLog");
    expect(prisma.executeCalls.join("\n")).toContain("CREATE INDEX IF NOT EXISTS idx_world_delta_log_version");
  });
});
