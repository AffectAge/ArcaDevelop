import { describe, expect, it } from "vitest";
import { AdminAuditLogStore, normalizeAdminAuditLog } from "./adminAuditLog";

describe("AdminAuditLogStore", () => {
  it("adds context, sanitizes metadata, and lists recent entries", () => {
    let turnId = 3;
    const store = new AdminAuditLogStore(
      () => ({ turnId, activeScenarioId: "scenario:test" }),
      () => ({ auditLog: { maxEntries: 10, retentionTurns: null } }),
    );

    const entry = store.push({
      actorCountryId: "country:admin",
      action: "scenario.apply",
      targetType: "scenario",
      targetId: "scenario:test",
      metadata: { nested: { ok: true } },
    });
    turnId = 4;
    store.push({
      actorCountryId: "country:admin",
      action: "country.delete",
      targetType: "country",
      targetId: "country:test",
      metadata: { deleted: true },
    });

    expect(entry.turnId).toBe(3);
    expect(entry.scenarioId).toBe("scenario:test");
    expect(store.listRecent(2).map((row) => row.action)).toEqual(["country.delete", "scenario.apply"]);
  });

  it("prunes by max entries and retention turns", () => {
    let turnId = 1;
    const store = new AdminAuditLogStore(
      () => ({ turnId, activeScenarioId: "scenario:test" }),
      () => ({ auditLog: { maxEntries: 2, retentionTurns: 2 } }),
    );

    for (turnId = 1; turnId <= 4; turnId += 1) {
      store.push({
        actorCountryId: "country:admin",
        action: "scenario.apply",
        targetType: "scenario",
        targetId: `scenario:${turnId}`,
        metadata: {},
      });
    }

    expect(store.snapshot().map((row) => row.turnId)).toEqual([4, 3]);
  });

  it("normalizes persisted entries conservatively", () => {
    const entries = normalizeAdminAuditLog([
      {
        id: "1",
        createdAt: "2026-01-01T00:00:00.000Z",
        turnId: 2.7,
        actorCountryId: "country:admin",
        action: "unknown",
        targetType: "unknown",
        targetId: "target",
        scenarioId: "scenario:test",
        metadata: { ok: true },
      },
      { id: "broken" },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      turnId: 2,
      action: "scenario.apply",
      targetType: "scenario",
    });
  });
});
