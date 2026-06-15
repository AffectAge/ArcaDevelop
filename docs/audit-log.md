# Audit Log

Privileged and destructive actions need audit events.

## Required Event Fields

- actor id,
- actor role/permission,
- action code,
- target type,
- target id,
- scenario id,
- timestamp,
- safe metadata,
- before/after summary when practical.

## Actions To Log

- admin mutations,
- forced resolve,
- scenario apply/import/export,
- defines/theme/content edits,
- Arcawiki admin edits,
- country deletion/mutation,
- registration approval,
- punishment/lock/unlock,
- upload cleanup,
- permission changes,
- AI control switching.

## Retention

Audit logs must have configurable retention:

- max age,
- max count,
- pruning interval,
- optional export/archive before prune.

Audit storage must not grow forever.

## Current Server Behavior

The server keeps a bounded admin audit log in persisted `GameState.adminAuditLogJson`. Admins can read recent entries through `GET /admin/audit-log?limit=<n>`.

Current retention settings live in persisted game settings and may be seeded by scenario `common/defines.json` when a scenario is applied:

- `auditLog.maxEntries`: maximum retained entries, hard-capped by the server.
- `auditLog.retentionTurns`: optional turn-age retention; `null` disables age pruning.

Country deletion and scenario apply must record audit entries with safe metadata. Country deletion audit metadata includes the non-destructive cleanup plan that was built before mutation.

The `adminAuditLogJson` database field is additive. Runtime table bootstrap adds it to older SQLite `GameState` tables if missing, preserving existing state.

Example scenario defines:

```json
{
  "auditLog": {
    "maxEntries": 1000,
    "retentionTurns": null
  }
}
```
