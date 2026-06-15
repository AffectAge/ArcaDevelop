import { randomUUID } from "node:crypto";

export const DEFAULT_ADMIN_AUDIT_MAX_ENTRIES = 1_000;
export const HARD_MAX_ADMIN_AUDIT_LOG = 10_000;

export type AdminAuditLogEntry = {
  id: string;
  createdAt: string;
  turnId: number;
  actorCountryId: string;
  action: "country.delete" | "scenario.apply";
  targetType: "country" | "scenario";
  targetId: string;
  scenarioId: string;
  metadata: Record<string, unknown>;
};

export type AdminAuditLogRetentionSettings = {
  maxEntries: number;
  retentionTurns: number | null;
};

export type AdminAuditLogContext = {
  turnId: number;
  activeScenarioId: string;
};

export type AdminAuditLogSettingsSource = {
  auditLog?: {
    maxEntries?: unknown;
    retentionTurns?: unknown;
  };
};

export class AdminAuditLogStore {
  private readonly entries: AdminAuditLogEntry[] = [];

  constructor(
    private readonly getContext: () => AdminAuditLogContext,
    private readonly getSettings: () => AdminAuditLogSettingsSource,
  ) {}

  push(entry: Omit<AdminAuditLogEntry, "id" | "createdAt" | "turnId" | "scenarioId">): AdminAuditLogEntry {
    const context = this.getContext();
    const next: AdminAuditLogEntry = {
      ...entry,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      turnId: context.turnId,
      scenarioId: context.activeScenarioId,
      metadata: sanitizeAuditMetadata(entry.metadata),
    };
    this.entries.unshift(next);
    this.prune();
    return next;
  }

  getRetentionSettings(): AdminAuditLogRetentionSettings {
    const configured = this.getSettings().auditLog;
    return {
      maxEntries: Math.max(
        1,
        Math.min(HARD_MAX_ADMIN_AUDIT_LOG, Math.floor(Number(configured?.maxEntries ?? DEFAULT_ADMIN_AUDIT_MAX_ENTRIES))),
      ),
      retentionTurns:
        typeof configured?.retentionTurns === "number" && Number.isFinite(configured.retentionTurns)
          ? Math.max(1, Math.floor(configured.retentionTurns))
          : null,
    };
  }

  prune(): void {
    const { maxEntries, retentionTurns } = this.getRetentionSettings();
    if (retentionTurns != null) {
      const minTurnId = this.getContext().turnId - retentionTurns + 1;
      for (let i = this.entries.length - 1; i >= 0; i -= 1) {
        if (this.entries[i].turnId < minTurnId) {
          this.entries.splice(i, 1);
        }
      }
    }
    if (this.entries.length > maxEntries) {
      this.entries.length = maxEntries;
    }
  }

  replaceFromPersisted(input: unknown): void {
    this.entries.splice(0, this.entries.length, ...normalizeAdminAuditLog(input));
    this.prune();
  }

  snapshot(): AdminAuditLogEntry[] {
    return this.entries.slice(0, this.getRetentionSettings().maxEntries);
  }

  listRecent(limit: number): AdminAuditLogEntry[] {
    this.prune();
    return this.entries.slice(0, limit);
  }
}

function sanitizeAuditMetadata(input: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
}

export function normalizeAdminAuditLog(input: unknown): AdminAuditLogEntry[] {
  if (!Array.isArray(input)) return [];
  return input
    .flatMap((entry): AdminAuditLogEntry[] => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Partial<AdminAuditLogEntry>;
      if (
        typeof row.id !== "string" ||
        typeof row.createdAt !== "string" ||
        typeof row.turnId !== "number" ||
        typeof row.actorCountryId !== "string" ||
        typeof row.action !== "string" ||
        typeof row.targetType !== "string" ||
        typeof row.targetId !== "string" ||
        typeof row.scenarioId !== "string"
      ) {
        return [];
      }
      return [
        {
          id: row.id,
          createdAt: row.createdAt,
          turnId: Math.max(1, Math.floor(row.turnId)),
          actorCountryId: row.actorCountryId,
          action: row.action === "country.delete" ? "country.delete" : "scenario.apply",
          targetType: row.targetType === "country" ? "country" : "scenario",
          targetId: row.targetId,
          scenarioId: row.scenarioId,
          metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {},
        },
      ];
    })
    .slice(0, HARD_MAX_ADMIN_AUDIT_LOG);
}
