import type express from "express";
import type { RouteAuth } from "../security/routeAuth";

export type AdminAuditRetentionSettings = {
  maxEntries: number;
  retentionTurns: number | null;
};

export type AdminAuditLogReader = {
  prune: () => void;
  getRetentionSettings: () => AdminAuditRetentionSettings;
  listRecent: (limit: number) => unknown[];
};

export type AdminMetadataRoutesDependencies = {
  routeAuth: RouteAuth;
  getActiveScenarioId: () => string;
  listScenarios: () => unknown[];
  auditLogStore: AdminAuditLogReader;
};

export function registerAdminMetadataRoutes(app: express.Express, deps: AdminMetadataRoutesDependencies): void {
  app.get("/admin/scenarios", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    return res.json({ activeScenarioId: deps.getActiveScenarioId(), scenarios: deps.listScenarios() });
  });

  app.get("/admin/audit-log", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    deps.auditLogStore.prune();
    const retention = deps.auditLogStore.getRetentionSettings();
    const limit = normalizeAuditLogLimit(req.query.limit, retention.maxEntries);
    return res.json({ entries: deps.auditLogStore.listRecent(limit), retention });
  });
}

export function normalizeAuditLogLimit(rawLimit: unknown, maxEntries: number): number {
  return Math.max(1, Math.min(maxEntries, 200, Math.floor(Number(rawLimit ?? 100))));
}
